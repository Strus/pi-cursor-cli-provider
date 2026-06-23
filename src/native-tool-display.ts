import {
    createBashToolDefinition,
    createEditToolDefinition,
    createGrepToolDefinition,
    createLsToolDefinition,
    createReadToolDefinition,
    type ExtensionAPI,
    type ExtensionContext,
    type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { type TSchema, Type } from "typebox";
import { getCursorEditPath, prepareCursorEditArguments } from "./cursor-edit-args.js";

const NATIVE_CURSOR_TOOL_NAMES = ["read", "bash", "edit", "grep", "ls", "cursor_edit", "cursor_write"] as const;
type NativeCursorToolName = (typeof NATIVE_CURSOR_TOOL_NAMES)[number];

const NATIVE_CURSOR_TOOL_DISPLAY_ENV = "PI_CURSOR_NATIVE_TOOL_DISPLAY";
const NATIVE_CURSOR_TOOL_REGISTRATION_ENV = "PI_CURSOR_REGISTER_NATIVE_TOOLS";

const cursorReplayToolSchema = Type.Object({}, { additionalProperties: true });

interface PiToolDisplayResult {
    content: Array<{ type: "text"; text: string }>;
    details?: unknown;
}

export interface CursorNativeToolDisplayItem {
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    result: PiToolDisplayResult;
    isError: boolean;
    terminate?: boolean;
}

const registeredNativeToolNames = new Set<NativeCursorToolName>();
const nativeToolResults = new Map<string, CursorNativeToolDisplayItem>();

function readBooleanEnv(name: string): boolean | undefined {
    const value = process.env[name]?.trim().toLowerCase();
    if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
    if (value === "0" || value === "false" || value === "no" || value === "off") return false;
    return undefined;
}

function isCursorNativeToolDisplayRequested(): boolean {
    const override = readBooleanEnv(NATIVE_CURSOR_TOOL_DISPLAY_ENV);
    if (override !== undefined) return override;
    return process.stdout.isTTY === true;
}

function isCursorNativeToolRegistrationRequested(): boolean {
    return readBooleanEnv(NATIVE_CURSOR_TOOL_REGISTRATION_ENV) !== false && isCursorNativeToolDisplayRequested();
}

function isNativeCursorToolName(toolName: string): toolName is NativeCursorToolName {
    return NATIVE_CURSOR_TOOL_NAMES.some((nativeToolName) => nativeToolName === toolName);
}

export function canRenderCursorToolNatively(toolName: string): boolean {
    return isNativeCursorToolName(toolName) && registeredNativeToolNames.has(toolName);
}

export function recordCursorNativeToolDisplay(item: CursorNativeToolDisplayItem): boolean {
    if (!canRenderCursorToolNatively(item.toolName)) return false;
    nativeToolResults.set(item.id, item);
    return true;
}

export function deleteCursorNativeToolDisplay(id: string): void {
    nativeToolResults.delete(id);
}

function consumeCursorNativeToolDisplay(id: string): CursorNativeToolDisplayItem | undefined {
    const item = nativeToolResults.get(id);
    if (item) nativeToolResults.delete(id);
    return item;
}

function wrapNativeCursorTool<TParams extends TSchema, TDetails, TState>(
    definition: ToolDefinition<TParams, TDetails, TState>,
    getCurrentDefinition: () => ToolDefinition<TParams, TDetails, TState>,
): ToolDefinition<TParams, TDetails, TState> {
    return {
        ...definition,
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            const cursorDisplay = consumeCursorNativeToolDisplay(toolCallId);
            if (cursorDisplay) {
                return {
                    content: cursorDisplay.result.content,
                    details: cursorDisplay.result.details as TDetails,
                    isError: cursorDisplay.isError,
                    terminate: cursorDisplay.terminate ?? true,
                };
            }
            return getCurrentDefinition().execute(toolCallId, params, signal, onUpdate, ctx);
        },
    };
}

interface CursorReplayToolDetails {
    cursorToolName?: "edit" | "write";
    suppressDisplay?: boolean;
    path?: string;
    linesAdded?: number;
    linesRemoved?: number;
    linesCreated?: number;
    fileSize?: number;
    diffString?: string;
}

function asCursorReplayToolDetails(value: unknown): CursorReplayToolDetails | undefined {
    return value && typeof value === "object" ? (value as CursorReplayToolDetails) : undefined;
}

function getCursorReplayPath(
    args: Record<string, unknown> | undefined,
    details: CursorReplayToolDetails | undefined,
): string {
    return details?.path ?? getCursorEditPath(args) ?? "unknown";
}

type CursorReplayRenderCall = NonNullable<ToolDefinition<typeof cursorReplayToolSchema, unknown>["renderCall"]>;
type CursorReplayRenderResult = NonNullable<ToolDefinition<typeof cursorReplayToolSchema, unknown>["renderResult"]>;
type CursorReplayRenderTheme = Parameters<CursorReplayRenderCall>[1];

function formatCursorReplayDiff(diff: string, theme: CursorReplayRenderTheme, maxLines: number): string {
    const lines = diff.split("\n");
    const visible = lines.slice(0, maxLines);
    const rendered = visible.map((line) => {
        if (line.startsWith("+") && !line.startsWith("+++")) return theme.fg("success", line);
        if (line.startsWith("-") && !line.startsWith("---")) return theme.fg("error", line);
        return theme.fg("muted", line);
    });
    if (lines.length > maxLines) rendered.push(theme.fg("muted", `... (${lines.length - maxLines} more diff lines)`));
    return rendered.join("\n");
}

function renderCursorReplayCall(
    toolName: "cursor_edit" | "cursor_write",
    args: Record<string, unknown> | undefined,
    theme: CursorReplayRenderTheme,
    isPartial: boolean,
): Text {
    if (!isPartial) return new Text("", 0, 0);
    const cursorToolName = toolName === "cursor_edit" ? "edit" : "write";
    const text = `${theme.fg("toolTitle", theme.bold(`Cursor ${cursorToolName} `))}${theme.fg("accent", getCursorReplayPath(args, undefined))}`;
    return new Text(text, 0, 0);
}

function pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function classifyCursorEditOperation(
    details: CursorReplayToolDetails,
): "created" | "deleted" | "updated" | "unchanged" {
    if (!details.diffString && !details.linesAdded && !details.linesRemoved) return "unchanged";
    if (details.diffString?.startsWith("--- /dev/null")) return "created";
    if (details.diffString?.includes("\n+++ /dev/null")) return "deleted";
    return "updated";
}

function formatCursorEditSummary(details: CursorReplayToolDetails): string {
    const operation = classifyCursorEditOperation(details);
    if (operation === "unchanged") return "no changes needed";
    if (operation === "created" && details.linesAdded !== undefined)
        return `created ${pluralize(details.linesAdded, "line")}`;
    if (operation === "deleted" && details.linesRemoved !== undefined)
        return `deleted ${pluralize(details.linesRemoved, "line")}`;
    const parts = [
        details.linesAdded ? `added ${pluralize(details.linesAdded, "line")}` : undefined,
        details.linesRemoved ? `removed ${pluralize(details.linesRemoved, "line")}` : undefined,
    ].filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(", ") : "updated file";
}

function renderCursorReplayResult(
    result: Parameters<CursorReplayRenderResult>[0],
    options: Parameters<CursorReplayRenderResult>[1],
    theme: Parameters<CursorReplayRenderResult>[2],
    isError: boolean,
): Text {
    if (options.isPartial) return new Text(theme.fg("warning", "Replaying Cursor tool result..."), 0, 0);
    const details = asCursorReplayToolDetails(result.details);
    if (details?.suppressDisplay === true) return new Text("", 0, 0);
    const content = result.content[0];
    const text = content?.type === "text" ? content.text : "";
    if (isError) return new Text(theme.fg("error", text.split("\n")[0] || "Cursor replay failed"), 0, 0);

    if (details?.cursorToolName === "edit") {
        const summary = formatCursorEditSummary(details);
        let rendered = `${theme.fg("toolTitle", theme.bold(`Cursor ${classifyCursorEditOperation(details)}`))} ${theme.fg("accent", getCursorReplayPath(undefined, details))} ${theme.fg("success", summary)}`;
        if (details.diffString)
            rendered += options.expanded
                ? `\n${formatCursorReplayDiff(details.diffString, theme, 40)}`
                : theme.fg("muted", " (expand for diff)");
        return new Text(rendered, 0, 0);
    }

    if (details?.cursorToolName === "write") {
        const parts = [
            details.linesCreated !== undefined ? pluralize(details.linesCreated, "line") : undefined,
            details.fileSize !== undefined ? `${details.fileSize} bytes` : undefined,
        ].filter(Boolean);
        const summary = parts.length > 0 ? parts.join(", ") : "written";
        return new Text(
            `${theme.fg("toolTitle", theme.bold("Cursor write"))} ${theme.fg("accent", getCursorReplayPath(undefined, details))} ${theme.fg("success", summary)}`,
            0,
            0,
        );
    }

    return new Text(text || theme.fg("success", "Cursor tool result replayed"), 0, 0);
}

function createCursorReplayOnlyToolDefinition(
    toolName: "cursor_edit" | "cursor_write",
): ToolDefinition<typeof cursorReplayToolSchema, unknown> {
    const cursorToolName = toolName === "cursor_edit" ? "edit" : "write";
    return {
        name: toolName,
        label: `Cursor ${cursorToolName}`,
        description: `Replay display for a Cursor CLI ${cursorToolName} operation. This tool only returns recorded Cursor results and never mutates files directly.`,
        promptSnippet: `Render a recorded Cursor CLI ${cursorToolName} operation without mutating files.`,
        promptGuidelines: [
            `Use ${toolName} only for replaying Cursor CLI ${cursorToolName} results that were already produced by Cursor; ${toolName} does not perform file mutations.`,
        ],
        parameters: cursorReplayToolSchema,
        renderShell: "self",
        async execute() {
            return {
                content: [],
                details: { cursorToolName, suppressDisplay: true },
                isError: false,
                terminate: true,
            };
        },
        renderCall(args, theme, context) {
            return renderCursorReplayCall(toolName, args as Record<string, unknown>, theme, context.isPartial);
        },
        renderResult(result, options, theme, context) {
            return renderCursorReplayResult(result, options, theme, context.isError);
        },
    };
}

function createNativeCursorToolDefinition(
    toolName: NativeCursorToolName,
    cwd: string,
): ToolDefinition<TSchema, unknown, unknown> {
    if (toolName === "read") return createReadToolDefinition(cwd) as ToolDefinition<TSchema, unknown, unknown>;
    if (toolName === "bash") return createBashToolDefinition(cwd) as ToolDefinition<TSchema, unknown, unknown>;
    if (toolName === "edit") {
        const definition = createEditToolDefinition(cwd) as ToolDefinition<TSchema, unknown, unknown>;
        return {
            ...definition,
            parameters: cursorReplayToolSchema,
            prepareArguments: prepareCursorEditArguments,
            renderCall(args, theme) {
                const path = getCursorEditPath(args as Record<string, unknown>) ?? "unknown";
                const text = `${theme.fg("toolTitle", theme.bold("edit"))} ${theme.fg("accent", path)}`;
                return new Text(text, 0, 0);
            },
        };
    }
    if (toolName === "grep") return createGrepToolDefinition(cwd) as ToolDefinition<TSchema, unknown, unknown>;
    if (toolName === "ls") return createLsToolDefinition(cwd) as ToolDefinition<TSchema, unknown, unknown>;
    return createCursorReplayOnlyToolDefinition(toolName) as ToolDefinition<TSchema, unknown, unknown>;
}

function registerNativeCursorTool(pi: ExtensionAPI, toolName: NativeCursorToolName): void {
    const definition = createNativeCursorToolDefinition(toolName, process.cwd());
    pi.registerTool(wrapNativeCursorTool(definition, () => createNativeCursorToolDefinition(toolName, process.cwd())));
}

function hasNonBuiltinTool(pi: ExtensionAPI, toolName: NativeCursorToolName): boolean {
    const existingTool = pi.getAllTools().find((tool) => tool.name === toolName);
    return existingTool !== undefined && existingTool.sourceInfo.source !== "builtin";
}

type NativeRegistrationContext = { hasUI: boolean; ui: Pick<ExtensionContext["ui"], "notify"> };

function activateRegisteredNativeCursorTools(pi: ExtensionAPI): void {
    if (registeredNativeToolNames.size === 0) return;
    const activeToolNames = new Set(pi.getActiveTools());
    let changed = false;
    for (const toolName of registeredNativeToolNames) {
        if (activeToolNames.has(toolName)) continue;
        activeToolNames.add(toolName);
        changed = true;
    }
    if (changed) pi.setActiveTools([...activeToolNames]);
}

function registerAvailableNativeCursorTools(pi: ExtensionAPI, ctx: NativeRegistrationContext): void {
    if (!isCursorNativeToolRegistrationRequested()) {
        registeredNativeToolNames.clear();
        return;
    }

    const skippedToolNames: string[] = [];
    for (const toolName of NATIVE_CURSOR_TOOL_NAMES) {
        if (registeredNativeToolNames.has(toolName)) continue;
        if (hasNonBuiltinTool(pi, toolName)) {
            skippedToolNames.push(toolName);
            continue;
        }
        registerNativeCursorTool(pi, toolName);
        registeredNativeToolNames.add(toolName);
    }

    activateRegisteredNativeCursorTools(pi);

    if (skippedToolNames.length > 0 && readBooleanEnv(NATIVE_CURSOR_TOOL_DISPLAY_ENV) === true && ctx.hasUI) {
        ctx.ui.notify(
            `Cursor native tool replay skipped for ${skippedToolNames.join(", ")} because another extension already provides ${skippedToolNames.length === 1 ? "that tool" : "those tools"}. Cursor will use text transcripts for skipped tools.`,
            "warning",
        );
    }
}

export function registerCursorNativeToolDisplay(pi: ExtensionAPI): void {
    pi.on("session_start", (_event, ctx) => {
        registerAvailableNativeCursorTools(pi, ctx);
    });
}
