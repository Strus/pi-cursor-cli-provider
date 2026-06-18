import { spawn } from "node:child_process";
import type { ThinkingLevel, ThinkingLevelMap } from "@earendil-works/pi-ai";

export interface CursorModelDef {
    id: string;
    name: string;
    reasoning: boolean;
    contextWindow: number;
    maxTokens: number;
}

/** Explicit `-thinking` variants are always reasoning-capable. */
const THINKING_VARIANT_RE = /-thinking(?:-|$)/;

const REASONING_LEVELS = ["minimal", "low", "medium", "high", "xhigh"] as const satisfies readonly ThinkingLevel[];

/**
 * Static fallback list. Used when `agent models` fails or times out, and as
 * an attribute lookup table for models discovered dynamically.
 *
 * Source: `agent models` output (Cursor CLI v2026.06.15)
 */
export const STATIC_MODELS: CursorModelDef[] = [
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

interface ModelVariants {
    default: string;
    minimal?: string;
    low?: string;
    medium?: string;
    high?: string;
    xhigh?: string;
}

function opusThinkingVariants(version: "4-7" | "4-8"): ModelVariants {
    const prefix = `claude-opus-${version}`;
    return {
        default: `${prefix}-xhigh`,
        minimal: `${prefix}-thinking-low`,
        low: `${prefix}-thinking-low`,
        medium: `${prefix}-thinking-medium`,
        high: `${prefix}-thinking-high`,
        xhigh: `${prefix}-thinking-xhigh`,
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
        const child = spawn(agentPath, args, {
            stdio: ["ignore", "pipe", "pipe"],
            env: process.env,
        });

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
