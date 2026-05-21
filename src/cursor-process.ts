import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Context } from "@earendil-works/pi-ai";
import {
    type CursorNativeToolDisplayItem,
    canRenderCursorToolNatively,
    deleteCursorNativeToolDisplay,
} from "./native-tool-display.js";
import { buildCursorPiToolDisplay, type CursorToolCallPayload, renderCompletedToolCall } from "./renderer.js";

const DEFAULT_CURSOR_AGENT_PATH = "agent";
const CURSOR_NATIVE_REPLAY_TOOL_ID_PATTERN = /^(cursor-cli-replay-\d+-\d+)-tool-\d+$/;

export function getCursorAgentPath(): string {
    return process.env.CURSOR_AGENT_PATH ?? process.env.AGENT_PATH ?? DEFAULT_CURSOR_AGENT_PATH;
}

export interface CursorAssistantEvent {
    type: "assistant";
    message: {
        role: "assistant";
        content: Array<{ type: "text"; text: string }>;
    };
    session_id: string;
}

export interface CursorToolCallEvent {
    type: "tool_call";
    subtype: "started" | "completed";
    /** The outer object has exactly one key: the tool name (e.g. "shellToolCall"). */
    tool_call: Record<string, CursorToolCallPayload>;
}

export interface CursorThinkingEvent {
    type: "thinking";
    subtype: "delta" | "completed";
    text?: string;
}

interface CursorResultEvent {
    type: "result";
    subtype: string;
    duration_ms: number;
}

interface CursorEventBase {
    type: string;
    session_id?: string;
}

export type CursorStreamEvent =
    | CursorAssistantEvent
    | CursorThinkingEvent
    | CursorToolCallEvent
    | CursorResultEvent
    | CursorEventBase;

export type CursorNativeQueuedEvent =
    | { type: "thinking-delta"; text: string }
    | { type: "thinking-completed" }
    | { type: "text-delta"; text: string }
    | { type: "tool"; tool: CursorNativeToolDisplayItem }
    | { type: "done" }
    | { type: "error"; message: string };

export interface CursorNativeLiveRun {
    id: string;
    pendingEvents: CursorNativeQueuedEvent[];
    pendingEventIndex: number;
    recordedToolDisplayIds: string[];
    waiters: Set<() => void>;
    done: boolean;
    errorMessage?: string;
    child?: ReturnType<typeof spawn>;
    toolCounter: number;
}

interface StartCursorNativeRunOptions {
    agentPath: string;
    args: string[];
    signal?: AbortSignal;
    onSessionId: (cursorSessionId: string) => void;
}

let cursorNativeReplayCounter = 0;
const pendingCursorNativeRuns = new Map<string, CursorNativeLiveRun>();
const MAX_STDERR_CHARS = 64 * 1024;

export function parseLine(line: string): CursorStreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed) as CursorStreamEvent;
    } catch {
        return null;
    }
}

export function getCursorSessionId(event: CursorStreamEvent): string | undefined {
    const sessionId = (event as CursorEventBase).session_id;
    return typeof sessionId === "string" && sessionId.trim() ? sessionId : undefined;
}

function createCursorNativeReplayId(): string {
    cursorNativeReplayCounter += 1;
    return `cursor-cli-replay-${Date.now()}-${cursorNativeReplayCounter}`;
}

function getCursorNativeReplayIdFromToolCallId(toolCallId: string): string | undefined {
    return CURSOR_NATIVE_REPLAY_TOOL_ID_PATTERN.exec(toolCallId)?.[1];
}

export function getPendingCursorNativeReplayId(context: Context): string | undefined {
    for (let index = context.messages.length - 1; index >= 0; index -= 1) {
        const message = context.messages[index];
        if (message.role !== "toolResult") break;
        const replayId = getCursorNativeReplayIdFromToolCallId(message.toolCallId);
        if (replayId && pendingCursorNativeRuns.has(replayId)) return replayId;
    }
    return undefined;
}

export function getPendingCursorNativeRun(replayId: string): CursorNativeLiveRun | undefined {
    return pendingCursorNativeRuns.get(replayId);
}

function notifyCursorNativeRun(run: CursorNativeLiveRun): void {
    for (const waiter of run.waiters) waiter();
    run.waiters.clear();
}

function queueCursorNativeEvent(run: CursorNativeLiveRun, event: CursorNativeQueuedEvent): void {
    run.pendingEvents.push(event);
    notifyCursorNativeRun(run);
}

export async function waitForCursorNativeRunProgress(run: CursorNativeLiveRun, signal?: AbortSignal): Promise<void> {
    if (run.pendingEventIndex < run.pendingEvents.length || run.done || run.errorMessage !== undefined) return;
    await new Promise<void>((resolve, reject) => {
        let waiter: (() => void) | undefined;
        const cleanup = () => {
            if (waiter) run.waiters.delete(waiter);
            signal?.removeEventListener("abort", onAbort);
        };
        const onAbort = () => {
            cleanup();
            reject(new Error("aborted"));
        };
        waiter = () => {
            cleanup();
            resolve();
        };
        run.waiters.add(waiter);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

export function getCursorNativeQueuedEventCount(run: CursorNativeLiveRun): number {
    return run.pendingEvents.length - run.pendingEventIndex;
}

export function peekCursorNativeQueuedEvent(run: CursorNativeLiveRun): CursorNativeQueuedEvent | undefined {
    return run.pendingEvents[run.pendingEventIndex];
}

export function takeCursorNativeQueuedEvent(run: CursorNativeLiveRun): CursorNativeQueuedEvent | undefined {
    const event = run.pendingEvents[run.pendingEventIndex];
    if (!event) return undefined;
    run.pendingEventIndex += 1;
    if (run.pendingEventIndex > 64 && run.pendingEventIndex * 2 > run.pendingEvents.length) {
        run.pendingEvents.splice(0, run.pendingEventIndex);
        run.pendingEventIndex = 0;
    }
    return event;
}

export function disposeCursorNativeRun(run: CursorNativeLiveRun): void {
    pendingCursorNativeRuns.delete(run.id);
    for (const id of run.recordedToolDisplayIds) deleteCursorNativeToolDisplay(id);
    run.recordedToolDisplayIds.length = 0;
}

export function startCursorNativeRun(options: StartCursorNativeRunOptions): CursorNativeLiveRun {
    const run: CursorNativeLiveRun = {
        id: createCursorNativeReplayId(),
        pendingEvents: [],
        pendingEventIndex: 0,
        recordedToolDisplayIds: [],
        waiters: new Set(),
        done: false,
        toolCounter: 0,
    };
    pendingCursorNativeRuns.set(run.id, run);

    const child = spawn(options.agentPath, options.args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
    });
    run.child = child;

    const onAbort = () => {
        child.kill("SIGTERM");
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    const stderrChunks: string[] = [];
    let stderrLength = 0;
    child.stderr?.on("data", (chunk: Buffer) => {
        let text = chunk.toString();
        stderrLength += text.length;
        stderrChunks.push(text);
        while (stderrLength > MAX_STDERR_CHARS && stderrChunks.length > 0) {
            const first = stderrChunks[0];
            const overflow = stderrLength - MAX_STDERR_CHARS;
            if (first.length <= overflow) {
                stderrLength -= first.length;
                stderrChunks.shift();
                continue;
            }
            text = first.slice(overflow);
            stderrChunks[0] = text;
            stderrLength -= overflow;
        }
    });

    const stdout = child.stdout;
    if (!stdout) {
        throw new Error("Child process has no stdout (expected pipe)");
    }
    const rl = createInterface({ input: stdout, crlfDelay: Infinity });

    rl.on("line", (line: string) => {
        const event = parseLine(line);
        if (!event) return;

        const cursorSessionId = getCursorSessionId(event);
        if (cursorSessionId) options.onSessionId(cursorSessionId);

        if (event.type === "assistant") {
            const ae = event as CursorAssistantEvent;
            for (const block of ae.message.content) {
                if (block.type === "text" && block.text.trim()) {
                    queueCursorNativeEvent(run, { type: "text-delta", text: block.text });
                }
            }
            return;
        }

        if (event.type === "thinking") {
            const te = event as CursorThinkingEvent;
            if (te.subtype === "delta") queueCursorNativeEvent(run, { type: "thinking-delta", text: te.text ?? "" });
            if (te.subtype === "completed") queueCursorNativeEvent(run, { type: "thinking-completed" });
            return;
        }

        if (event.type === "tool_call") {
            const tce = event as CursorToolCallEvent;
            if (tce.subtype !== "completed") return;
            const cliKey = Object.keys(tce.tool_call)[0];
            if (!cliKey) return;
            const payload = tce.tool_call[cliKey];
            if (!payload) return;

            const display = buildCursorPiToolDisplay(cliKey, payload);
            if (canRenderCursorToolNatively(display.toolName)) {
                queueCursorNativeEvent(run, {
                    type: "tool",
                    tool: {
                        ...display,
                        id: `${run.id}-tool-${++run.toolCounter}`,
                    },
                });
            } else {
                queueCursorNativeEvent(run, {
                    type: "text-delta",
                    text: renderCompletedToolCall(cliKey, payload),
                });
            }
        }
    });

    child.on("close", (code) => {
        options.signal?.removeEventListener("abort", onAbort);
        run.done = true;
        if (options.signal?.aborted) {
            run.errorMessage = "aborted";
            queueCursorNativeEvent(run, { type: "error", message: "aborted" });
            return;
        }
        if (code !== 0) {
            const stderr = stderrChunks.join("").trim();
            run.errorMessage = stderr || `Cursor CLI exited with code ${code}`;
            queueCursorNativeEvent(run, { type: "error", message: run.errorMessage });
            return;
        }
        queueCursorNativeEvent(run, { type: "done" });
    });

    child.on("error", (err) => {
        options.signal?.removeEventListener("abort", onAbort);
        run.done = true;
        run.errorMessage = err.message;
        queueCursorNativeEvent(run, { type: "error", message: err.message });
    });

    return run;
}
