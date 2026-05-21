/**
 * Pi Cursor Provider Extension
 *
 * Routes Pi model requests through the Cursor Agent CLI (`agent`) so that any
 * active Cursor subscription can be used from inside Pi.
 *
 * Authentication is handled by the CLI itself — run `agent login` (or set the
 * CURSOR_API_KEY environment variable) before using this provider.
 *
 * Configuration env vars:
 *   CURSOR_AGENT_PATH   Path to the Cursor Agent CLI binary (default: "agent")
 *   CURSOR_API_KEY      API key for Cursor (used by the agent subprocess if set)
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
    Api,
    AssistantMessage,
    AssistantMessageEventStream,
    Context,
    ImageContent,
    Model,
    SimpleStreamOptions,
    TextContent,
} from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
    type CursorNativeLiveRun,
    disposeCursorNativeRun,
    getCursorAgentPath,
    getCursorNativeQueuedEventCount,
    getPendingCursorNativeReplayId,
    getPendingCursorNativeRun,
    peekCursorNativeQueuedEvent,
    startCursorNativeRun,
    takeCursorNativeQueuedEvent,
    waitForCursorNativeRunProgress,
} from "./cursor-process.js";
import { runAgentModels, STATIC_MODELS, toCursorId, toProviderModels } from "./models.js";
import {
    type CursorNativeToolDisplayItem,
    recordCursorNativeToolDisplay,
    registerCursorNativeToolDisplay,
} from "./native-tool-display.js";

// ---------------------------------------------------------------------------
// Prompt serialisation
// Serialises the Pi context into a single text prompt for the CLI.
// The first Cursor CLI invocation receives the full Pi context. Once we have
// a Cursor chat session id, later invocations resume that chat and only send
// the latest user prompt.
// ---------------------------------------------------------------------------

const CURSOR_SESSION_ENTRY_TYPE = "cursor-cli-session";

interface CursorSessionEntryData {
    cursorSessionId: string | null;
}

interface CursorSessionState {
    current: string | undefined;
    persisted: string | null;
    pending: string | null | undefined;
}

interface PromptTempFiles {
    dir: string | null;
    imageCount: number;
}

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
};

function stripDataUrlPrefix(data: string): string {
    return data.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
}

function getImageExtension(mimeType: string): string {
    return MIME_TYPE_TO_EXTENSION[mimeType] ?? "bin";
}

async function ensurePromptTempDir(state: PromptTempFiles): Promise<string> {
    if (state.dir) return state.dir;
    state.dir = await mkdtemp(join(tmpdir(), "pi-cursor-cli-images-"));
    return state.dir;
}

async function cleanupPromptTempFiles(state: PromptTempFiles): Promise<void> {
    if (!state.dir) return;
    const dir = state.dir;
    state.dir = null;
    await rm(dir, { recursive: true, force: true });
}

async function imageBlockToPromptText(block: ImageContent, state: PromptTempFiles): Promise<string> {
    try {
        const dir = await ensurePromptTempDir(state);
        state.imageCount += 1;
        const extension = getImageExtension(block.mimeType);
        const path = join(dir, `image-${state.imageCount}.${extension}`);
        const data = stripDataUrlPrefix(block.data);
        await writeFile(path, Buffer.from(data, "base64"));
        return path;
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to save image (${block.mimeType}) to a temporary file for Cursor CLI: ${reason}`);
    }
}

async function contentBlockToText(block: TextContent | ImageContent, state: PromptTempFiles): Promise<string> {
    if (block.type === "text") return block.text;
    return imageBlockToPromptText(block, state);
}

async function serializeContentBlocks(blocks: (TextContent | ImageContent)[], state: PromptTempFiles): Promise<string> {
    const lines: string[] = [];
    for (const block of blocks) {
        lines.push(await contentBlockToText(block, state));
    }
    return lines.join("\n");
}

async function serializeMessageContent(
    content: string | (TextContent | ImageContent)[],
    state: PromptTempFiles,
): Promise<string> {
    if (typeof content === "string") return content;
    return serializeContentBlocks(content, state);
}

async function serializeContext(context: Context, state: PromptTempFiles): Promise<string> {
    const lines: string[] = [];

    if (context.systemPrompt) {
        lines.push(`[System]\n${context.systemPrompt}\n`);
    }

    for (const msg of context.messages) {
        if (msg.role === "user") {
            const text = await serializeMessageContent(msg.content, state);
            lines.push(`[User]\n${text}`);
        } else if (msg.role === "assistant") {
            const text = msg.content
                .filter((c): c is TextContent => c.type === "text")
                .map((c) => c.text)
                .join("\n");
            if (text.trim()) {
                lines.push(`[Assistant]\n${text}`);
            }
        } else if (msg.role === "toolResult") {
            const text = await serializeContentBlocks(msg.content, state);
            if (text.trim()) {
                lines.push(`[Tool result: ${msg.toolName}]\n${text}`);
            }
        }
    }

    return lines.join("\n\n");
}

async function serializeLatestUserPrompt(context: Context, state: PromptTempFiles): Promise<string> {
    for (let i = context.messages.length - 1; i >= 0; i -= 1) {
        const message = context.messages[i];
        if (message.role !== "user") continue;
        return serializeMessageContent(message.content, state);
    }
    return serializeContext(context, state);
}

function restoreCursorSessionId(ctx: ExtensionContext): string | undefined {
    let cursorSessionId: string | undefined;

    for (const entry of ctx.sessionManager.getBranch()) {
        if (entry.type !== "custom" || entry.customType !== CURSOR_SESSION_ENTRY_TYPE) {
            continue;
        }

        const data = entry.data as CursorSessionEntryData | undefined;
        const value = data?.cursorSessionId;
        cursorSessionId = typeof value === "string" && value.trim() ? value : undefined;
    }

    return cursorSessionId;
}

function persistCursorSessionId(
    pi: ExtensionAPI,
    state: CursorSessionState,
    cursorSessionId: string | undefined,
): void {
    const nextPersisted = cursorSessionId ?? null;
    if (state.persisted === nextPersisted) return;

    pi.appendEntry<CursorSessionEntryData>(CURSOR_SESSION_ENTRY_TYPE, {
        cursorSessionId: nextPersisted,
    });
    state.persisted = nextPersisted;
}

function syncCursorSessionState(ctx: ExtensionContext, state: CursorSessionState): string | undefined {
    const restored = restoreCursorSessionId(ctx);
    state.current = restored;
    state.persisted = restored ?? null;
    state.pending = undefined;
    return restored;
}

// ---------------------------------------------------------------------------
// streamSimple — the custom backend for the cursor provider
// ---------------------------------------------------------------------------

function createStreamCursorCli(cursorSessionState: CursorSessionState) {
    return function streamCursorCli(
        model: Model<Api>,
        context: Context,
        options?: SimpleStreamOptions,
    ): AssistantMessageEventStream {
        const stream = createAssistantMessageEventStream();

        (async () => {
            const startTime = Date.now();
            let firstTokenTime: number | undefined;

            const output: AssistantMessage & {
                duration?: number;
                ttft?: number;
            } = {
                role: "assistant",
                content: [],
                api: model.api,
                provider: model.provider,
                model: model.id,
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: {
                        input: 0,
                        output: 0,
                        cacheRead: 0,
                        cacheWrite: 0,
                        total: 0,
                    },
                },
                stopReason: "stop",
                timestamp: Date.now(),
            };

            const setTiming = () => {
                output.duration = Date.now() - startTime;
                output.ttft = firstTokenTime != null ? firstTokenTime - startTime : undefined;
            };

            const promptTempFiles: PromptTempFiles = {
                dir: null,
                imageCount: 0,
            };

            try {
                let nativeTextIndex = -1;
                let nativeThinkingIndex = -1;

                const closeNativeTextBlock = () => {
                    if (nativeTextIndex < 0) return;
                    const contentIndex = nativeTextIndex;
                    nativeTextIndex = -1;
                    const block = output.content[contentIndex];
                    if (block.type !== "text") return;
                    stream.push({ type: "text_end", contentIndex, content: block.text, partial: output });
                };

                const closeNativeThinkingBlock = () => {
                    if (nativeThinkingIndex < 0) return;
                    const contentIndex = nativeThinkingIndex;
                    nativeThinkingIndex = -1;
                    const block = output.content[contentIndex];
                    if (block.type === "thinking") {
                        stream.push({ type: "thinking_end", contentIndex, content: block.thinking, partial: output });
                    }
                };

                const appendNativeTextDelta = (delta: string) => {
                    if (!delta) return;
                    if (firstTokenTime === undefined) firstTokenTime = Date.now();
                    closeNativeThinkingBlock();
                    if (nativeTextIndex < 0) {
                        nativeTextIndex = output.content.length;
                        output.content.push({ type: "text", text: "" });
                        stream.push({ type: "text_start", contentIndex: nativeTextIndex, partial: output });
                    }
                    const block = output.content[nativeTextIndex];
                    if (block.type !== "text") return;
                    block.text += delta;
                    stream.push({ type: "text_delta", contentIndex: nativeTextIndex, delta, partial: output });
                };

                const appendNativeThinkingDelta = (delta: string) => {
                    if (!delta) return;
                    if (firstTokenTime === undefined) firstTokenTime = Date.now();
                    closeNativeTextBlock();
                    if (nativeThinkingIndex < 0) {
                        nativeThinkingIndex = output.content.length;
                        output.content.push({ type: "thinking", thinking: "" });
                        stream.push({
                            type: "thinking_start",
                            contentIndex: nativeThinkingIndex,
                            partial: output,
                        });
                    }
                    const block = output.content[nativeThinkingIndex];
                    if (block.type !== "thinking") return;
                    block.thinking += delta;
                    stream.push({
                        type: "thinking_delta",
                        contentIndex: nativeThinkingIndex,
                        delta,
                        partial: output,
                    });
                };

                const emitNativeToolUseTurn = (run: CursorNativeLiveRun, tools: CursorNativeToolDisplayItem[]) => {
                    closeNativeThinkingBlock();
                    closeNativeTextBlock();
                    const shouldTerminate = run.done && getCursorNativeQueuedEventCount(run) === 0;
                    for (const tool of tools) {
                        const contentIndex = output.content.length;
                        output.content.push({
                            type: "toolCall",
                            id: tool.id,
                            name: tool.toolName,
                            arguments: tool.args,
                        });
                        stream.push({ type: "toolcall_start", contentIndex, partial: output });
                        stream.push({
                            type: "toolcall_delta",
                            contentIndex,
                            delta: JSON.stringify(tool.args),
                            partial: output,
                        });
                        const block = output.content[contentIndex];
                        if (block.type === "toolCall")
                            stream.push({ type: "toolcall_end", contentIndex, toolCall: block, partial: output });
                        if (recordCursorNativeToolDisplay({ ...tool, terminate: shouldTerminate })) {
                            run.recordedToolDisplayIds.push(tool.id);
                        }
                    }
                    output.stopReason = "toolUse";
                    setTiming();
                    stream.push({ type: "done", reason: "toolUse", message: output });
                    stream.end();
                };

                const drainNativeRun = async (run: CursorNativeLiveRun) => {
                    stream.push({ type: "start", partial: output });
                    while (true) {
                        await waitForCursorNativeRunProgress(run, options?.signal);

                        const tools: CursorNativeToolDisplayItem[] = [];
                        while (peekCursorNativeQueuedEvent(run)?.type === "tool") {
                            const event = takeCursorNativeQueuedEvent(run);
                            if (event?.type === "tool") tools.push(event.tool);
                        }
                        if (tools.length > 0) {
                            emitNativeToolUseTurn(run, tools);
                            return;
                        }

                        const event = takeCursorNativeQueuedEvent(run);
                        if (!event) continue;
                        if (event.type === "text-delta") appendNativeTextDelta(event.text);
                        if (event.type === "thinking-delta") appendNativeThinkingDelta(event.text);
                        if (event.type === "thinking-completed") closeNativeThinkingBlock();
                        if (event.type === "error") {
                            closeNativeThinkingBlock();
                            closeNativeTextBlock();
                            output.stopReason = "error";
                            output.errorMessage = event.message;
                            setTiming();
                            disposeCursorNativeRun(run);
                            stream.push({ type: "error", reason: "error", error: output });
                            stream.end();
                            return;
                        }
                        if (event.type === "done") {
                            closeNativeThinkingBlock();
                            closeNativeTextBlock();
                            setTiming();
                            disposeCursorNativeRun(run);
                            stream.push({ type: "done", reason: "stop", message: output });
                            stream.end();
                            return;
                        }
                    }
                };

                const pendingReplayId = getPendingCursorNativeReplayId(context);
                if (pendingReplayId) {
                    const run = getPendingCursorNativeRun(pendingReplayId);
                    if (run) {
                        await drainNativeRun(run);
                        return;
                    }
                }

                const agentPath = getCursorAgentPath();

                const workspacePath = process.cwd();
                const prompt = cursorSessionState.current
                    ? await serializeLatestUserPrompt(context, promptTempFiles)
                    : await serializeContext(context, promptTempFiles);
                const reasoningLevel = (options as { reasoning?: string })?.reasoning;
                const cliModelId = toCursorId(model.id, reasoningLevel);

                const args = ["--print", "--yolo", "--output-format", "stream-json", "--model", cliModelId];

                if (cursorSessionState.current) {
                    args.push("--resume", cursorSessionState.current);
                }

                args.push("--trust", "--workspace", workspacePath, prompt);

                if (process.env.CURSOR_API_KEY) {
                    args.unshift("--api-key", process.env.CURSOR_API_KEY);
                }

                const run = startCursorNativeRun({
                    agentPath,
                    args,
                    signal: options?.signal,
                    onSessionId: (cursorSessionId) => {
                        cursorSessionState.current = cursorSessionId;
                        if (cursorSessionState.persisted !== cursorSessionId) {
                            cursorSessionState.pending = cursorSessionId;
                        }
                    },
                });
                await drainNativeRun(run);
            } catch (error) {
                output.stopReason = options?.signal?.aborted ? "aborted" : "error";
                output.errorMessage = error instanceof Error ? error.message : String(error);
                setTiming();
                stream.push({
                    type: "error",
                    reason: output.stopReason,
                    error: output,
                });
                stream.end();
            } finally {
                await cleanupPromptTempFiles(promptTempFiles);
            }
        })();

        return stream;
    };
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default async function (pi: ExtensionAPI) {
    registerCursorNativeToolDisplay(pi);

    const agentPath = getCursorAgentPath();
    const cursorSessionState: CursorSessionState = {
        current: undefined,
        persisted: null,
        pending: undefined,
    };

    pi.on("session_start", async (event, ctx) => {
        const restored = syncCursorSessionState(ctx, cursorSessionState);
        if ((event.reason === "new" || event.reason === "fork") && restored) {
            cursorSessionState.current = undefined;
            cursorSessionState.pending = undefined;
            persistCursorSessionId(pi, cursorSessionState, undefined);
        }
    });

    pi.on("session_tree", async (_event, ctx) => {
        syncCursorSessionState(ctx, cursorSessionState);
    });

    pi.on("agent_end", async () => {
        if (cursorSessionState.pending === undefined) return;

        const pending = cursorSessionState.pending;
        cursorSessionState.pending = undefined;
        persistCursorSessionId(pi, cursorSessionState, pending ?? undefined);
    });

    let modelDefs = STATIC_MODELS;
    try {
        modelDefs = await runAgentModels(agentPath);
    } catch {
        // assume CLI is not available if `agent models` fails - do not register provider
        return;
    }

    pi.registerProvider("cursor", {
        baseUrl: "cli://cursor-agent",
        apiKey: "CURSOR_API_KEY",
        api: "cursor-cli" as Api,
        models: toProviderModels(modelDefs),
        streamSimple: createStreamCursorCli(cursorSessionState),
    });
}
