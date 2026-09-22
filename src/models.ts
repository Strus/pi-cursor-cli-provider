import type { ThinkingLevel, ThinkingLevelMap } from "@earendil-works/pi-ai";
import { spawnCursorAgent } from "./agent-spawn.js";

export interface CursorModelDef {
    id: string;
    name: string;
    reasoning: boolean;
    contextWindow: number;
    maxTokens: number;
}

/** Explicit `-thinking` variants are always reasoning-capable. */
const THINKING_VARIANT_RE = /-thinking(?:-|$)/;

const REASONING_LEVELS = [
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
] as const satisfies readonly ThinkingLevel[];

/** Known context and output limits retained across model-list updates. */
const STATIC_MODEL_METADATA: CursorModelDef[] = [
    {
        id: "auto",
        name: "Auto",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.3-codex-low",
        name: "Codex 5.3 Low",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.3-codex-low-fast",
        name: "Codex 5.3 Low Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.3-codex",
        name: "Codex 5.3",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.3-codex-fast",
        name: "Codex 5.3 Fast",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.3-codex-high",
        name: "Codex 5.3 High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.3-codex-high-fast",
        name: "Codex 5.3 High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.3-codex-xhigh",
        name: "Codex 5.3 Extra High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.3-codex-xhigh-fast",
        name: "Codex 5.3 Extra High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2",
        name: "GPT-5.2",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-codex-low",
        name: "Codex 5.2 Low",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-codex-low-fast",
        name: "Codex 5.2 Low Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-codex",
        name: "Codex 5.2",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-codex-fast",
        name: "Codex 5.2 Fast",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-codex-high",
        name: "Codex 5.2 High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-codex-high-fast",
        name: "Codex 5.2 High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-codex-xhigh",
        name: "Codex 5.2 Extra High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-codex-xhigh-fast",
        name: "Codex 5.2 Extra High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-codex-max-low",
        name: "Codex 5.1 Max Low",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-codex-max-low-fast",
        name: "Codex 5.1 Max Low Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-codex-max-medium",
        name: "Codex 5.1 Max",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-codex-max-medium-fast",
        name: "Codex 5.1 Max Medium Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-codex-max-high",
        name: "Codex 5.1 Max High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-codex-max-high-fast",
        name: "Codex 5.1 Max High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-codex-max-xhigh",
        name: "Codex 5.1 Max Extra High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-codex-max-xhigh-fast",
        name: "Codex 5.1 Max Extra High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "composer-2.5",
        name: "Composer 2.5",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "claude-opus-4-8-thinking-high",
        name: "Opus 4.8 1M Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "gpt-5.5-high",
        name: "GPT-5.5 1M High",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.5-high-fast",
        name: "GPT-5.5 High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "claude-opus-4-7-thinking-high",
        name: "Opus 4.7 1M High Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "gpt-5.4-high",
        name: "GPT-5.4 1M High",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-high-fast",
        name: "GPT-5.4 High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "composer-2.5-fast",
        name: "Composer 2.5 Fast",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "claude-opus-4-8-low",
        name: "Opus 4.8 1M Low",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-8-medium",
        name: "Opus 4.8 1M Medium",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-8-high",
        name: "Opus 4.8 1M",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-8-xhigh",
        name: "Opus 4.8 1M Extra High",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-8-max",
        name: "Opus 4.8 1M Max",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-8-thinking-low",
        name: "Opus 4.8 1M Low Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-8-thinking-medium",
        name: "Opus 4.8 1M Medium Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-8-thinking-xhigh",
        name: "Opus 4.8 1M Extra High Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-8-thinking-max",
        name: "Opus 4.8 1M Max Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "gpt-5.5-none",
        name: "GPT-5.5 1M None",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.5-none-fast",
        name: "GPT-5.5 None Fast",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.5-low",
        name: "GPT-5.5 1M Low",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.5-low-fast",
        name: "GPT-5.5 Low Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.5-medium",
        name: "GPT-5.5 1M",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.5-medium-fast",
        name: "GPT-5.5 Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.5-extra-high",
        name: "GPT-5.5 1M Extra High",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.5-extra-high-fast",
        name: "GPT-5.5 Extra High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "claude-4.6-sonnet-medium",
        name: "Sonnet 4.6 1M",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-4.6-sonnet-medium-thinking",
        name: "Sonnet 4.6 1M Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-7-low",
        name: "Opus 4.7 1M Low",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-7-medium",
        name: "Opus 4.7 1M Medium",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-7-high",
        name: "Opus 4.7 1M High",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-7-xhigh",
        name: "Opus 4.7 1M",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-7-max",
        name: "Opus 4.7 1M Max",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-7-thinking-low",
        name: "Opus 4.7 1M Low Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-7-thinking-medium",
        name: "Opus 4.7 1M Medium Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-7-thinking-xhigh",
        name: "Opus 4.7 1M Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-opus-4-7-thinking-max",
        name: "Opus 4.7 1M Max Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "grok-build-0.1",
        name: "Grok Build 0.1 1M",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-low",
        name: "GPT-5.4 1M Low",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-medium",
        name: "GPT-5.4 1M",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-medium-fast",
        name: "GPT-5.4 Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-xhigh",
        name: "GPT-5.4 1M Extra High",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-xhigh-fast",
        name: "GPT-5.4 Extra High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "claude-4.6-opus-high",
        name: "Opus 4.6 1M",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-4.6-opus-max",
        name: "Opus 4.6 1M Max",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-4.6-opus-high-thinking",
        name: "Opus 4.6 1M Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-4.6-opus-max-thinking",
        name: "Opus 4.6 1M Max Thinking",
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 32000,
    },
    {
        id: "claude-4.5-opus-high",
        name: "Opus 4.5",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32000,
    },
    {
        id: "claude-4.5-opus-high-thinking",
        name: "Opus 4.5 Thinking",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32000,
    },
    {
        id: "gpt-5.2-low",
        name: "GPT-5.2 Low",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-low-fast",
        name: "GPT-5.2 Low Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-fast",
        name: "GPT-5.2 Fast",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-high",
        name: "GPT-5.2 High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-high-fast",
        name: "GPT-5.2 High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-xhigh",
        name: "GPT-5.2 Extra High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.2-xhigh-fast",
        name: "GPT-5.2 Extra High Fast",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gemini-3.1-pro",
        name: "Gemini 3.1 Pro",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 65536,
    },
    {
        id: "gpt-5.4-mini-none",
        name: "GPT-5.4 Mini None",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-mini-low",
        name: "GPT-5.4 Mini Low",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-mini-medium",
        name: "GPT-5.4 Mini",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-mini-high",
        name: "GPT-5.4 Mini High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-mini-xhigh",
        name: "GPT-5.4 Mini Extra High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-nano-none",
        name: "GPT-5.4 Nano None",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-nano-low",
        name: "GPT-5.4 Nano Low",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-nano-medium",
        name: "GPT-5.4 Nano",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-nano-high",
        name: "GPT-5.4 Nano High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.4-nano-xhigh",
        name: "GPT-5.4 Nano Extra High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "grok-4.3",
        name: "Grok 4.3 1M",
        reasoning: false,
        contextWindow: 1000000,
        maxTokens: 32768,
    },
    {
        id: "claude-4.5-sonnet",
        name: "Sonnet 4.5",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32000,
    },
    {
        id: "claude-4.5-sonnet-thinking",
        name: "Sonnet 4.5 Thinking",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32000,
    },
    {
        id: "gpt-5.1-low",
        name: "GPT-5.1 Low",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1",
        name: "GPT-5.1",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-high",
        name: "GPT-5.1 High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gemini-3-flash",
        name: "Gemini 3 Flash",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 65536,
    },
    {
        id: "gemini-3.5-flash",
        name: "Gemini 3.5 Flash",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 65536,
    },
    {
        id: "gpt-5.1-codex-mini-low",
        name: "Codex 5.1 Mini Low",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-codex-mini",
        name: "Codex 5.1 Mini",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "gpt-5.1-codex-mini-high",
        name: "Codex 5.1 Mini High",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "claude-4-sonnet",
        name: "Sonnet 4",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32000,
    },
    {
        id: "claude-4-sonnet-thinking",
        name: "Sonnet 4 Thinking",
        reasoning: true,
        contextWindow: 200000,
        maxTokens: 32000,
    },
    {
        id: "gpt-5-mini",
        name: "GPT-5 Mini",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
    {
        id: "kimi-k2.5",
        name: "Kimi K2.5",
        reasoning: false,
        contextWindow: 200000,
        maxTokens: 32768,
    },
];

/**
 * Static fallback list. Used when `agent models` fails or times out, and as
 * an attribute lookup table for models discovered dynamically.
 *
 * Source: `agent models` output (Cursor CLI v2026.08.04-aaa8809)
 */
const STATIC_MODEL_ENTRIES = [
    ["auto", "Auto"],
    ["gpt-5.3-codex-low", "Codex 5.3 Low"],
    ["gpt-5.3-codex-low-fast", "Codex 5.3 Low Fast"],
    ["gpt-5.3-codex", "Codex 5.3"],
    ["gpt-5.3-codex-fast", "Codex 5.3 Fast"],
    ["gpt-5.3-codex-high", "Codex 5.3 High"],
    ["gpt-5.3-codex-high-fast", "Codex 5.3 High Fast"],
    ["gpt-5.3-codex-xhigh", "Codex 5.3 Extra High"],
    ["gpt-5.3-codex-xhigh-fast", "Codex 5.3 Extra High Fast"],
    ["gpt-5.2", "GPT-5.2"],
    ["cursor-grok-4.5-high", "Cursor Grok 4.5"],
    ["cursor-grok-4.5-high-fast", "Cursor Grok 4.5 Fast"],
    ["composer-2.5", "Composer 2.5"],
    ["claude-opus-5-thinking-high", "Opus 5 1M Thinking"],
    ["claude-opus-5-thinking-high-fast", "Opus 5 1M Thinking Fast"],
    ["claude-opus-5-thinking-xhigh", "Opus 5 1M Extra High Thinking"],
    ["claude-opus-5-thinking-xhigh-fast", "Opus 5 1M Extra High Thinking Fast"],
    ["claude-opus-4-8-thinking-high", "Opus 4.8 1M Thinking"],
    ["gpt-5.6-sol-high", "GPT-5.6 Sol 1M High"],
    ["gpt-5.6-sol-high-fast", "GPT-5.6 Sol High Fast"],
    ["gpt-5.6-sol-xhigh", "GPT-5.6 Sol 1M Extra High"],
    ["gpt-5.6-sol-xhigh-fast", "GPT-5.6 Sol Extra High Fast"],
    ["gpt-5.5-high", "GPT-5.5 1M High"],
    ["gpt-5.5-high-fast", "GPT-5.5 High Fast"],
    ["claude-sonnet-5-thinking-high", "Sonnet 5 1M Thinking"],
    ["claude-sonnet-5-thinking-xhigh", "Sonnet 5 1M Extra High Thinking"],
    ["kimi-k3-high", "Kimi K3 High"],
    ["cursor-grok-4.5-low", "Cursor Grok 4.5 Low"],
    ["cursor-grok-4.5-low-fast", "Cursor Grok 4.5 Low Fast"],
    ["cursor-grok-4.5-medium", "Cursor Grok 4.5 Medium"],
    ["cursor-grok-4.5-medium-fast", "Cursor Grok 4.5 Medium Fast"],
    ["composer-2.5-fast", "Composer 2.5 Fast"],
    ["claude-opus-5-low", "Opus 5 1M Low"],
    ["claude-opus-5-low-fast", "Opus 5 1M Low Fast"],
    ["claude-opus-5-medium", "Opus 5 1M Medium"],
    ["claude-opus-5-medium-fast", "Opus 5 1M Medium Fast"],
    ["claude-opus-5-high", "Opus 5 1M"],
    ["claude-opus-5-high-fast", "Opus 5 1M Fast"],
    ["claude-opus-5-thinking-low", "Opus 5 1M Low Thinking"],
    ["claude-opus-5-thinking-low-fast", "Opus 5 1M Low Thinking Fast"],
    ["claude-opus-5-thinking-medium", "Opus 5 1M Medium Thinking"],
    ["claude-opus-5-thinking-medium-fast", "Opus 5 1M Medium Thinking Fast"],
    ["claude-opus-5-thinking-max", "Opus 5 1M Max Thinking"],
    ["claude-opus-5-thinking-max-fast", "Opus 5 1M Max Thinking Fast"],
    ["claude-opus-4-8-low", "Opus 4.8 1M Low"],
    ["claude-opus-4-8-medium", "Opus 4.8 1M Medium"],
    ["claude-opus-4-8-high", "Opus 4.8 1M"],
    ["claude-opus-4-8-xhigh", "Opus 4.8 1M Extra High"],
    ["claude-opus-4-8-max", "Opus 4.8 1M Max"],
    ["claude-opus-4-8-thinking-low", "Opus 4.8 1M Low Thinking"],
    ["claude-opus-4-8-thinking-medium", "Opus 4.8 1M Medium Thinking"],
    ["claude-opus-4-8-thinking-xhigh", "Opus 4.8 1M Extra High Thinking"],
    ["claude-opus-4-8-thinking-max", "Opus 4.8 1M Max Thinking"],
    ["gpt-5.6-sol-none", "GPT-5.6 Sol 1M None"],
    ["gpt-5.6-sol-none-fast", "GPT-5.6 Sol None Fast"],
    ["gpt-5.6-sol-low", "GPT-5.6 Sol 1M Low"],
    ["gpt-5.6-sol-low-fast", "GPT-5.6 Sol Low Fast"],
    ["gpt-5.6-sol-medium", "GPT-5.6 Sol 1M"],
    ["gpt-5.6-sol-medium-fast", "GPT-5.6 Sol Fast"],
    ["gpt-5.6-sol-max", "GPT-5.6 Sol 1M Max"],
    ["gpt-5.6-sol-max-fast", "GPT-5.6 Sol Max Fast"],
    ["gpt-5.5-none", "GPT-5.5 1M None"],
    ["gpt-5.5-none-fast", "GPT-5.5 None Fast"],
    ["gpt-5.5-low", "GPT-5.5 1M Low"],
    ["gpt-5.5-low-fast", "GPT-5.5 Low Fast"],
    ["gpt-5.5-medium", "GPT-5.5 1M"],
    ["gpt-5.5-medium-fast", "GPT-5.5 Fast"],
    ["gpt-5.5-extra-high", "GPT-5.5 1M Extra High"],
    ["gpt-5.5-extra-high-fast", "GPT-5.5 Extra High Fast"],
    ["claude-sonnet-5-low", "Sonnet 5 1M Low"],
    ["claude-sonnet-5-medium", "Sonnet 5 1M Medium"],
    ["claude-sonnet-5-high", "Sonnet 5 1M"],
    ["claude-sonnet-5-xhigh", "Sonnet 5 1M Extra High"],
    ["claude-sonnet-5-max", "Sonnet 5 1M Max"],
    ["claude-sonnet-5-thinking-low", "Sonnet 5 1M Low Thinking"],
    ["claude-sonnet-5-thinking-medium", "Sonnet 5 1M Medium Thinking"],
    ["claude-sonnet-5-thinking-max", "Sonnet 5 1M Max Thinking"],
    ["gpt-5.6-terra-none", "GPT-5.6 Terra 1M None"],
    ["gpt-5.6-terra-none-fast", "GPT-5.6 Terra None Fast"],
    ["gpt-5.6-terra-low", "GPT-5.6 Terra 1M Low"],
    ["gpt-5.6-terra-low-fast", "GPT-5.6 Terra Low Fast"],
    ["gpt-5.6-terra-medium", "GPT-5.6 Terra 1M"],
    ["gpt-5.6-terra-medium-fast", "GPT-5.6 Terra Fast"],
    ["gpt-5.6-terra-high", "GPT-5.6 Terra 1M High"],
    ["gpt-5.6-terra-high-fast", "GPT-5.6 Terra High Fast"],
    ["gpt-5.6-terra-xhigh", "GPT-5.6 Terra 1M Extra High"],
    ["gpt-5.6-terra-xhigh-fast", "GPT-5.6 Terra Extra High Fast"],
    ["gpt-5.6-terra-max", "GPT-5.6 Terra 1M Max"],
    ["gpt-5.6-terra-max-fast", "GPT-5.6 Terra Max Fast"],
    ["claude-4.6-sonnet-medium", "Sonnet 4.6 1M"],
    ["claude-4.6-sonnet-medium-thinking", "Sonnet 4.6 1M Thinking"],
    ["claude-opus-4-7-low", "Opus 4.7 1M Low"],
    ["claude-opus-4-7-medium", "Opus 4.7 1M Medium"],
    ["claude-opus-4-7-high", "Opus 4.7 1M High"],
    ["claude-opus-4-7-xhigh", "Opus 4.7 1M"],
    ["claude-opus-4-7-max", "Opus 4.7 1M Max"],
    ["claude-opus-4-7-thinking-low", "Opus 4.7 1M Low Thinking"],
    ["claude-opus-4-7-thinking-medium", "Opus 4.7 1M Medium Thinking"],
    ["claude-opus-4-7-thinking-high", "Opus 4.7 1M High Thinking"],
    ["claude-opus-4-7-thinking-xhigh", "Opus 4.7 1M Thinking"],
    ["claude-opus-4-7-thinking-max", "Opus 4.7 1M Max Thinking"],
    ["gpt-5.4-low", "GPT-5.4 1M Low"],
    ["gpt-5.4-medium", "GPT-5.4 1M"],
    ["gpt-5.4-medium-fast", "GPT-5.4 Fast"],
    ["gpt-5.4-high", "GPT-5.4 1M High"],
    ["gpt-5.4-high-fast", "GPT-5.4 High Fast"],
    ["gpt-5.4-xhigh", "GPT-5.4 1M Extra High"],
    ["gpt-5.4-xhigh-fast", "GPT-5.4 Extra High Fast"],
    ["claude-4.6-opus-high", "Opus 4.6 1M"],
    ["claude-4.6-opus-max", "Opus 4.6 1M Max"],
    ["claude-4.6-opus-high-thinking", "Opus 4.6 1M Thinking"],
    ["claude-4.6-opus-max-thinking", "Opus 4.6 1M Max Thinking"],
    ["claude-4.5-opus-high", "Opus 4.5"],
    ["claude-4.5-opus-high-thinking", "Opus 4.5 Thinking"],
    ["gpt-5.2-low", "GPT-5.2 Low"],
    ["gpt-5.2-low-fast", "GPT-5.2 Low Fast"],
    ["gpt-5.2-fast", "GPT-5.2 Fast"],
    ["gpt-5.2-high", "GPT-5.2 High"],
    ["gpt-5.2-high-fast", "GPT-5.2 High Fast"],
    ["gpt-5.2-xhigh", "GPT-5.2 Extra High"],
    ["gpt-5.2-xhigh-fast", "GPT-5.2 Extra High Fast"],
    ["gpt-5.6-luna-none", "GPT-5.6 Luna 1M None"],
    ["gpt-5.6-luna-none-fast", "GPT-5.6 Luna None Fast"],
    ["gpt-5.6-luna-low", "GPT-5.6 Luna 1M Low"],
    ["gpt-5.6-luna-low-fast", "GPT-5.6 Luna Low Fast"],
    ["gpt-5.6-luna-medium", "GPT-5.6 Luna 1M"],
    ["gpt-5.6-luna-medium-fast", "GPT-5.6 Luna Fast"],
    ["gpt-5.6-luna-high", "GPT-5.6 Luna 1M High"],
    ["gpt-5.6-luna-high-fast", "GPT-5.6 Luna High Fast"],
    ["gpt-5.6-luna-xhigh", "GPT-5.6 Luna 1M Extra High"],
    ["gpt-5.6-luna-xhigh-fast", "GPT-5.6 Luna Extra High Fast"],
    ["gpt-5.6-luna-max", "GPT-5.6 Luna 1M Max"],
    ["gpt-5.6-luna-max-fast", "GPT-5.6 Luna Max Fast"],
    ["gemini-3.6-flash-minimal", "Gemini 3.6 Flash Minimal"],
    ["gemini-3.6-flash-low", "Gemini 3.6 Flash Low"],
    ["gemini-3.6-flash-medium", "Gemini 3.6 Flash Medium"],
    ["gemini-3.6-flash-high", "Gemini 3.6 Flash"],
    ["gemini-3.1-pro", "Gemini 3.1 Pro"],
    ["gpt-5.4-mini-none", "GPT-5.4 Mini None"],
    ["gpt-5.4-mini-low", "GPT-5.4 Mini Low"],
    ["gpt-5.4-mini-medium", "GPT-5.4 Mini"],
    ["gpt-5.4-mini-high", "GPT-5.4 Mini High"],
    ["gpt-5.4-mini-xhigh", "GPT-5.4 Mini Extra High"],
    ["gpt-5.4-nano-none", "GPT-5.4 Nano None"],
    ["gpt-5.4-nano-low", "GPT-5.4 Nano Low"],
    ["gpt-5.4-nano-medium", "GPT-5.4 Nano"],
    ["gpt-5.4-nano-high", "GPT-5.4 Nano High"],
    ["gpt-5.4-nano-xhigh", "GPT-5.4 Nano Extra High"],
    ["claude-4.5-sonnet", "Sonnet 4.5"],
    ["claude-4.5-sonnet-thinking", "Sonnet 4.5 Thinking"],
    ["gpt-5.1-low", "GPT-5.1 Low"],
    ["gpt-5.1", "GPT-5.1"],
    ["gpt-5.1-high", "GPT-5.1 High"],
    ["gemini-3-flash", "Gemini 3 Flash"],
    ["gemini-3.5-flash", "Gemini 3.5 Flash"],
    ["claude-4-sonnet", "Sonnet 4"],
    ["claude-4-sonnet-thinking", "Sonnet 4 Thinking"],
    ["gpt-5-mini", "GPT-5 Mini"],
    ["kimi-k3-low", "Kimi K3 Low"],
    ["kimi-k3-max", "Kimi K3"],
    ["kimi-k2.7-code", "Kimi K2.7 Code"],
] as const;

const STATIC_MODEL_METADATA_MAP = new Map(STATIC_MODEL_METADATA.map((model) => [model.id, model]));

export const STATIC_MODELS: CursorModelDef[] = STATIC_MODEL_ENTRIES.map(([id, name]) => {
    const known = STATIC_MODEL_METADATA_MAP.get(id);
    if (known) return { ...known, name };

    return {
        id,
        name,
        reasoning: THINKING_VARIANT_RE.test(id),
        contextWindow: name.includes("1M") ? 1000000 : 200000,
        maxTokens: id.startsWith("claude") ? 32000 : id.startsWith("gemini") ? 65536 : 32768,
    };
});

interface ModelVariants {
    default: string;
    minimal?: string;
    low?: string;
    medium?: string;
    high?: string;
    xhigh?: string;
    max?: string;
}

function opusThinkingVariants(version: "4-7" | "4-8" | "5", fast = false): ModelVariants {
    const prefix = `claude-opus-${version}`;
    const suffix = fast ? "-fast" : "";
    const defaultLevel = version === "5" ? "high" : "xhigh";
    return {
        default: `${prefix}-${defaultLevel}${suffix}`,
        minimal: `${prefix}-thinking-low${suffix}`,
        low: `${prefix}-thinking-low${suffix}`,
        medium: `${prefix}-thinking-medium${suffix}`,
        high: `${prefix}-thinking-high${suffix}`,
        xhigh: `${prefix}-thinking-xhigh${suffix}`,
        max: `${prefix}-thinking-max${suffix}`,
    };
}

const MODEL_MAP: Record<string, ModelVariants> = {
    "sonnet-4.5": {
        default: "claude-4.5-sonnet",
        minimal: "claude-4.5-sonnet-thinking",
        low: "claude-4.5-sonnet-thinking",
        medium: "claude-4.5-sonnet-thinking",
        high: "claude-4.5-sonnet-thinking",
        xhigh: "claude-4.5-sonnet-thinking",
    },
    "claude-sonnet-4-5": {
        default: "claude-4.5-sonnet",
        minimal: "claude-4.5-sonnet-thinking",
        low: "claude-4.5-sonnet-thinking",
        medium: "claude-4.5-sonnet-thinking",
        high: "claude-4.5-sonnet-thinking",
        xhigh: "claude-4.5-sonnet-thinking",
    },
    "sonnet-4.6": {
        default: "claude-4.6-sonnet-medium",
        minimal: "claude-4.6-sonnet-medium-thinking",
        low: "claude-4.6-sonnet-medium-thinking",
        medium: "claude-4.6-sonnet-medium-thinking",
        high: "claude-4.6-sonnet-medium-thinking",
        xhigh: "claude-4.6-sonnet-medium-thinking",
    },
    "claude-sonnet-4-6": {
        default: "claude-4.6-sonnet-medium",
        minimal: "claude-4.6-sonnet-medium-thinking",
        low: "claude-4.6-sonnet-medium-thinking",
        medium: "claude-4.6-sonnet-medium-thinking",
        high: "claude-4.6-sonnet-medium-thinking",
        xhigh: "claude-4.6-sonnet-medium-thinking",
    },
    "claude-sonnet-4": {
        default: "claude-4-sonnet",
        minimal: "claude-4-sonnet-thinking",
        low: "claude-4-sonnet-thinking",
        medium: "claude-4-sonnet-thinking",
        high: "claude-4-sonnet-thinking",
        xhigh: "claude-4-sonnet-thinking",
    },
    "claude-sonnet-4-1m": {
        default: "claude-4-sonnet-1m",
        minimal: "claude-4-sonnet-1m-thinking",
        low: "claude-4-sonnet-1m-thinking",
        medium: "claude-4-sonnet-1m-thinking",
        high: "claude-4-sonnet-1m-thinking",
        xhigh: "claude-4-sonnet-1m-thinking",
    },
    "opus-4.5": {
        default: "claude-4.5-opus-high",
        minimal: "claude-4.5-opus-high-thinking",
        low: "claude-4.5-opus-high-thinking",
        medium: "claude-4.5-opus-high-thinking",
        high: "claude-4.5-opus-high-thinking",
        xhigh: "claude-4.5-opus-high-thinking",
    },
    "claude-opus-4-5": {
        default: "claude-4.5-opus-high",
        minimal: "claude-4.5-opus-high-thinking",
        low: "claude-4.5-opus-high-thinking",
        medium: "claude-4.5-opus-high-thinking",
        high: "claude-4.5-opus-high-thinking",
        xhigh: "claude-4.5-opus-high-thinking",
    },
    "opus-4.6": {
        default: "claude-4.6-opus-high",
        minimal: "claude-4.6-opus-high-thinking",
        low: "claude-4.6-opus-high-thinking",
        medium: "claude-4.6-opus-high-thinking",
        high: "claude-4.6-opus-high-thinking",
        xhigh: "claude-4.6-opus-max-thinking",
    },
    "claude-opus-4-6": {
        default: "claude-4.6-opus-high",
        minimal: "claude-4.6-opus-high-thinking",
        low: "claude-4.6-opus-high-thinking",
        medium: "claude-4.6-opus-high-thinking",
        high: "claude-4.6-opus-high-thinking",
        xhigh: "claude-4.6-opus-max-thinking",
    },
    "claude-opus-4-7": opusThinkingVariants("4-7"),
    "claude-opus-4-8": opusThinkingVariants("4-8"),
    "claude-opus-5": opusThinkingVariants("5"),
    "claude-opus-5-fast": opusThinkingVariants("5", true),
    "claude-sonnet-5": {
        default: "claude-sonnet-5-high",
        minimal: "claude-sonnet-5-thinking-low",
        low: "claude-sonnet-5-thinking-low",
        medium: "claude-sonnet-5-thinking-medium",
        high: "claude-sonnet-5-thinking-high",
        xhigh: "claude-sonnet-5-thinking-xhigh",
        max: "claude-sonnet-5-thinking-max",
    },
    "gpt-5.1": {
        default: "gpt-5.1",
        minimal: "gpt-5.1-low",
        low: "gpt-5.1-low",
        medium: "gpt-5.1",
        high: "gpt-5.1-high",
        xhigh: "gpt-5.1-high",
    },
    "gpt-5.2": {
        default: "gpt-5.2",
        minimal: "gpt-5.2-low",
        low: "gpt-5.2-low",
        medium: "gpt-5.2",
        high: "gpt-5.2-high",
        xhigh: "gpt-5.2-xhigh",
    },
    "gpt-5.2-fast": {
        default: "gpt-5.2-fast",
        minimal: "gpt-5.2-low-fast",
        low: "gpt-5.2-low-fast",
        medium: "gpt-5.2-fast",
        high: "gpt-5.2-high-fast",
        xhigh: "gpt-5.2-xhigh-fast",
    },
    "gpt-5.2-codex": {
        default: "gpt-5.2-codex",
        minimal: "gpt-5.2-codex-low",
        low: "gpt-5.2-codex-low",
        medium: "gpt-5.2-codex",
        high: "gpt-5.2-codex-high",
        xhigh: "gpt-5.2-codex-xhigh",
    },
    "gpt-5.2-codex-fast": {
        default: "gpt-5.2-codex-fast",
        minimal: "gpt-5.2-codex-low-fast",
        low: "gpt-5.2-codex-low-fast",
        medium: "gpt-5.2-codex-fast",
        high: "gpt-5.2-codex-high-fast",
        xhigh: "gpt-5.2-codex-xhigh-fast",
    },
    "gpt-5.3-codex": {
        default: "gpt-5.3-codex",
        minimal: "gpt-5.3-codex-low",
        low: "gpt-5.3-codex-low",
        medium: "gpt-5.3-codex",
        high: "gpt-5.3-codex-high",
        xhigh: "gpt-5.3-codex-xhigh",
    },
    "gpt-5.3-codex-fast": {
        default: "gpt-5.3-codex-fast",
        minimal: "gpt-5.3-codex-low-fast",
        low: "gpt-5.3-codex-low-fast",
        medium: "gpt-5.3-codex-fast",
        high: "gpt-5.3-codex-high-fast",
        xhigh: "gpt-5.3-codex-xhigh-fast",
    },
    "gpt-5.3-codex-spark-preview": {
        default: "gpt-5.3-codex-spark-preview",
        minimal: "gpt-5.3-codex-spark-preview-low",
        low: "gpt-5.3-codex-spark-preview-low",
        medium: "gpt-5.3-codex-spark-preview",
        high: "gpt-5.3-codex-spark-preview-high",
        xhigh: "gpt-5.3-codex-spark-preview-xhigh",
    },
    "gpt-5.1-codex-max": {
        default: "gpt-5.1-codex-max-medium",
        minimal: "gpt-5.1-codex-max-low",
        low: "gpt-5.1-codex-max-low",
        medium: "gpt-5.1-codex-max-medium",
        high: "gpt-5.1-codex-max-high",
        xhigh: "gpt-5.1-codex-max-xhigh",
    },
    "gpt-5.1-codex-max-fast": {
        default: "gpt-5.1-codex-max-medium-fast",
        minimal: "gpt-5.1-codex-max-low-fast",
        low: "gpt-5.1-codex-max-low-fast",
        medium: "gpt-5.1-codex-max-medium-fast",
        high: "gpt-5.1-codex-max-high-fast",
        xhigh: "gpt-5.1-codex-max-xhigh-fast",
    },
    "gpt-5.1-codex-mini": {
        default: "gpt-5.1-codex-mini",
        minimal: "gpt-5.1-codex-mini-low",
        low: "gpt-5.1-codex-mini-low",
        medium: "gpt-5.1-codex-mini",
        high: "gpt-5.1-codex-mini-high",
        xhigh: "gpt-5.1-codex-mini-high",
    },
    "gpt-5.4": {
        default: "gpt-5.4-medium",
        minimal: "gpt-5.4-low",
        low: "gpt-5.4-low",
        medium: "gpt-5.4-medium",
        high: "gpt-5.4-high",
        xhigh: "gpt-5.4-xhigh",
    },
    "gpt-5.5": {
        default: "gpt-5.5-medium",
        minimal: "gpt-5.5-low",
        low: "gpt-5.5-low",
        medium: "gpt-5.5-medium",
        high: "gpt-5.5-high",
        xhigh: "gpt-5.5-extra-high",
    },
    "gpt-5.5-fast": {
        default: "gpt-5.5-medium-fast",
        minimal: "gpt-5.5-low-fast",
        low: "gpt-5.5-low-fast",
        medium: "gpt-5.5-medium-fast",
        high: "gpt-5.5-high-fast",
        xhigh: "gpt-5.5-extra-high-fast",
    },
    "gpt-5.6-sol": {
        default: "gpt-5.6-sol-medium",
        minimal: "gpt-5.6-sol-low",
        low: "gpt-5.6-sol-low",
        medium: "gpt-5.6-sol-medium",
        high: "gpt-5.6-sol-high",
        xhigh: "gpt-5.6-sol-xhigh",
        max: "gpt-5.6-sol-max",
    },
    "gpt-5.6-sol-fast": {
        default: "gpt-5.6-sol-medium-fast",
        minimal: "gpt-5.6-sol-low-fast",
        low: "gpt-5.6-sol-low-fast",
        medium: "gpt-5.6-sol-medium-fast",
        high: "gpt-5.6-sol-high-fast",
        xhigh: "gpt-5.6-sol-xhigh-fast",
        max: "gpt-5.6-sol-max-fast",
    },
    "gpt-5.6-terra": {
        default: "gpt-5.6-terra-medium",
        minimal: "gpt-5.6-terra-low",
        low: "gpt-5.6-terra-low",
        medium: "gpt-5.6-terra-medium",
        high: "gpt-5.6-terra-high",
        xhigh: "gpt-5.6-terra-xhigh",
        max: "gpt-5.6-terra-max",
    },
    "gpt-5.6-terra-fast": {
        default: "gpt-5.6-terra-medium-fast",
        minimal: "gpt-5.6-terra-low-fast",
        low: "gpt-5.6-terra-low-fast",
        medium: "gpt-5.6-terra-medium-fast",
        high: "gpt-5.6-terra-high-fast",
        xhigh: "gpt-5.6-terra-xhigh-fast",
        max: "gpt-5.6-terra-max-fast",
    },
    "gpt-5.6-luna": {
        default: "gpt-5.6-luna-medium",
        minimal: "gpt-5.6-luna-low",
        low: "gpt-5.6-luna-low",
        medium: "gpt-5.6-luna-medium",
        high: "gpt-5.6-luna-high",
        xhigh: "gpt-5.6-luna-xhigh",
        max: "gpt-5.6-luna-max",
    },
    "gpt-5.6-luna-fast": {
        default: "gpt-5.6-luna-medium-fast",
        minimal: "gpt-5.6-luna-low-fast",
        low: "gpt-5.6-luna-low-fast",
        medium: "gpt-5.6-luna-medium-fast",
        high: "gpt-5.6-luna-high-fast",
        xhigh: "gpt-5.6-luna-xhigh-fast",
        max: "gpt-5.6-luna-max-fast",
    },
    "gpt-5.4-fast": {
        default: "gpt-5.4-medium-fast",
        minimal: "gpt-5.4-medium-fast",
        low: "gpt-5.4-medium-fast",
        medium: "gpt-5.4-medium-fast",
        high: "gpt-5.4-high-fast",
        xhigh: "gpt-5.4-xhigh-fast",
    },
    "gpt-5.4-mini": {
        default: "gpt-5.4-mini-medium",
        minimal: "gpt-5.4-mini-low",
        low: "gpt-5.4-mini-low",
        medium: "gpt-5.4-mini-medium",
        high: "gpt-5.4-mini-high",
        xhigh: "gpt-5.4-mini-xhigh",
    },
    "gpt-5.4-nano": {
        default: "gpt-5.4-nano-medium",
        minimal: "gpt-5.4-nano-low",
        low: "gpt-5.4-nano-low",
        medium: "gpt-5.4-nano-medium",
        high: "gpt-5.4-nano-high",
        xhigh: "gpt-5.4-nano-xhigh",
    },
    "gemini-3-pro": { default: "gemini-3.1-pro" },
    "gemini-3-pro-preview": { default: "gemini-3.1-pro" },
    "gemini-3.1-pro-preview": { default: "gemini-3.1-pro" },
    "gemini-3-flash-preview": { default: "gemini-3-flash" },
    "gemini-3.5-flash": { default: "gemini-3.5-flash" },
    "gemini-3.6-flash": {
        default: "gemini-3.6-flash-high",
        minimal: "gemini-3.6-flash-minimal",
        low: "gemini-3.6-flash-low",
        medium: "gemini-3.6-flash-medium",
        high: "gemini-3.6-flash-high",
    },
    "cursor-grok-4.5": {
        default: "cursor-grok-4.5-high",
        minimal: "cursor-grok-4.5-low",
        low: "cursor-grok-4.5-low",
        medium: "cursor-grok-4.5-medium",
        high: "cursor-grok-4.5-high",
    },
    "cursor-grok-4.5-fast": {
        default: "cursor-grok-4.5-high-fast",
        minimal: "cursor-grok-4.5-low-fast",
        low: "cursor-grok-4.5-low-fast",
        medium: "cursor-grok-4.5-medium-fast",
        high: "cursor-grok-4.5-high-fast",
    },
    grok: {
        default: "grok-4.3",
    },
    "grok-code-fast-1": {
        default: "grok-4.3",
    },
    "grok-4.3": {
        default: "grok-4.3",
    },
    "grok-build-0.1": {
        default: "grok-build-0.1",
    },
    "kimi-k3": {
        default: "kimi-k3-max",
        low: "kimi-k3-low",
        high: "kimi-k3-high",
        max: "kimi-k3-max",
    },
};

const cursorDefaultToCanonical = new Map<string, string>();
const allMappedCursorIds = new Set<string>();
const mappedReasoningCursorIds = new Set<string>();
const canonicalThinkingLevelMaps = new Map<string, ThinkingLevelMap>();
for (const [canonicalId, variants] of Object.entries(MODEL_MAP)) {
    if (variants.default) cursorDefaultToCanonical.set(variants.default, canonicalId);
    for (const cursorId of Object.values(variants)) {
        if (cursorId) allMappedCursorIds.add(cursorId);
    }
    let hasVariants = false;
    const thinkingLevelMap: ThinkingLevelMap = {};
    for (const level of REASONING_LEVELS) {
        const cursorId = variants[level];
        if (cursorId) {
            mappedReasoningCursorIds.add(cursorId);
            hasVariants = true;
            thinkingLevelMap[level] = level;
        } else {
            thinkingLevelMap[level] = null;
        }
    }
    if (hasVariants) canonicalThinkingLevelMaps.set(canonicalId, thinkingLevelMap);
}

function isReasoningModelId(id: string): boolean {
    return THINKING_VARIANT_RE.test(id) || mappedReasoningCursorIds.has(id);
}

for (const model of STATIC_MODELS) {
    model.reasoning = model.reasoning || isReasoningModelId(model.id);
}

const STATIC_MODELS_MAP = new Map<string, CursorModelDef>(STATIC_MODELS.map((m) => [m.id, m]));

/**
 * Convert a Cursor CLI model ID to its canonical ID.
 * Returns null for variant-only IDs (e.g. thinking); they are not shown as separate models.
 * Returns the id as-is for unmapped models.
 */
function toCanonicalId(cursorId: string): string | null {
    const canonical = cursorDefaultToCanonical.get(cursorId);
    if (canonical) return canonical;
    if (allMappedCursorIds.has(cursorId)) return null;
    return cursorId;
}

/**
 * Resolve a canonical model ID (and optional reasoning level) to the Cursor CLI model ID.
 * Returns the id as-is for unmapped models.
 */
export function toCursorId(canonicalId: string, reasoning?: string): string {
    const family = MODEL_MAP[canonicalId];
    if (!family) return canonicalId;
    const level =
        reasoning && (REASONING_LEVELS as readonly string[]).includes(reasoning)
            ? (reasoning as ThinkingLevel)
            : undefined;
    const variant = level && family[level];
    return variant ?? family.default ?? canonicalId;
}

function hasReasoningVariants(canonicalId: string): boolean {
    return canonicalThinkingLevelMaps.has(canonicalId);
}

const DISCOVERY_TIMEOUT_MS = 15_000;

/**
 * Parse the text output of `agent models` into a list of model definitions.
 *
 * Expected format (one model per line after the header, before the tip):
 *   <id> - <name>  [(current[, default] | default)]
 *
 * Example lines:
 *   "auto - Auto"
 *   "opus-4.6-thinking - Claude 4.6 Opus (Thinking)  (default)"
 *   "sonnet-4.6 - Claude 4.6 Sonnet  (current)"
 */
function parseAgentModelsOutput(output: string): CursorModelDef[] {
    const results: CursorModelDef[] = [];
    // Match lines like: "model-id - Display Name  (optional flags)"
    const lineRe = /^([a-zA-Z0-9][a-zA-Z0-9._-]*)\s+-\s+(.+?)(?:\s+\((?:current|default|current,\s*default)\))?$/;

    for (const line of output.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("Available") || trimmed.startsWith("Tip:")) continue;
        const match = lineRe.exec(trimmed);
        if (!match) continue;

        const id = match[1].trim();
        const rawName = match[2].trim();

        // Use static attributes if available, otherwise infer
        const known = STATIC_MODELS_MAP.get(id);
        results.push({
            id,
            name: rawName,
            reasoning: known?.reasoning ?? isReasoningModelId(id),
            contextWindow: known?.contextWindow ?? 200000,
            maxTokens: known?.maxTokens ?? 32768,
        });
    }
    return results;
}

/**
 * Run `agent models` and return the parsed model list.
 * Rejects if the CLI exits with an error, produces no usable output, or
 * exceeds the discovery timeout.
 */
export function runAgentModels(agentPath: string): Promise<CursorModelDef[]> {
    return new Promise((resolve, reject) => {
        const args = ["models"];

        let stdout = "";
        let stderr = "";
        const child = spawnCursorAgent(agentPath, args);

        const timeout = setTimeout(() => {
            child.kill("SIGTERM");
            reject(new Error(`agent models timed out after ${DISCOVERY_TIMEOUT_MS}ms`));
        }, DISCOVERY_TIMEOUT_MS);

        child.stdout?.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
        });
        child.stderr?.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        child.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        child.on("close", (code) => {
            clearTimeout(timeout);
            if (code !== 0) {
                reject(new Error(`agent models exited with code ${code}: ${stderr.trim()}`));
                return;
            }
            const models = parseAgentModelsOutput(stdout);
            if (models.length === 0) {
                reject(new Error("agent models returned no models"));
                return;
            }
            resolve(models);
        });
    });
}

/**
 * Build a ProviderModelConfig array from a list of CursorModelDef entries.
 * Uses canonical IDs where a mapping exists and omits variant-only entries.
 */
export function toProviderModels(defs: CursorModelDef[]) {
    const seen = new Set<string>();
    return defs.flatMap((m) => {
        const canonicalId = toCanonicalId(m.id);
        if (canonicalId === null) return [];
        const id = canonicalId !== m.id ? canonicalId : m.id;
        if (seen.has(id)) return [];
        seen.add(id);
        const thinkingLevelMap = canonicalThinkingLevelMaps.get(id);
        return [
            {
                id,
                name: `${m.name} (Cursor)`,
                reasoning: m.reasoning || hasReasoningVariants(id),
                ...(thinkingLevelMap ? { thinkingLevelMap } : {}),
                input: ["text", "image"] as ("text" | "image")[],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: m.contextWindow,
                maxTokens: m.maxTokens,
            },
        ];
    });
}
