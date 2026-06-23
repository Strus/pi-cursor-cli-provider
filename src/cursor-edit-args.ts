export interface PiEditReplacement {
    oldText: string;
    newText: string;
}

export interface PiEditArgs {
    path: string;
    edits: PiEditReplacement[];
}

function getString(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return null;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
    return value != null && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

export function getCursorEditPath(args: Record<string, unknown> | undefined): string | null {
    const path = getString(args?.path) ?? getString(args?.file_path);
    if (!path) return null;
    const trimmed = path.trim();
    return trimmed || null;
}

function getStrictString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function getEditOldText(record: Record<string, unknown>): string | null {
    return getStrictString(record.oldText) ?? getStrictString(record.old_string) ?? getStrictString(record.oldString);
}

function getEditNewText(record: Record<string, unknown>): string | null {
    return getStrictString(record.newText) ?? getStrictString(record.new_string) ?? getStrictString(record.newString);
}

function isValidEditReplacement(oldText: string): boolean {
    return oldText.length > 0;
}

function parseEditsArray(value: unknown): PiEditReplacement[] | null {
    let editsValue = value;
    if (typeof editsValue === "string") {
        try {
            editsValue = JSON.parse(editsValue);
        } catch {
            return null;
        }
    }
    if (!Array.isArray(editsValue)) return null;
    if (editsValue.length === 0) return [];

    const edits: PiEditReplacement[] = [];
    for (const entry of editsValue) {
        const record = getRecord(entry);
        if (!record) return null;
        const oldText = getEditOldText(record);
        const newText = getEditNewText(record);
        if (oldText === null || newText === null || !isValidEditReplacement(oldText)) return null;
        edits.push({ oldText, newText });
    }

    return edits;
}

export function normalizeCursorEditArgsForPi(args: Record<string, unknown> | undefined): PiEditArgs | null {
    if (!args) return null;
    const path = getCursorEditPath(args);
    if (!path) return null;

    const edits = parseEditsArray(args.edits);
    if (edits === null) return null;
    if (edits.length > 0) return { path, edits };

    const oldText = getEditOldText(args);
    const newText = getEditNewText(args);
    if (oldText !== null && newText !== null && isValidEditReplacement(oldText)) {
        return { path, edits: [{ oldText, newText }] };
    }

    return null;
}

// Pi's edit tool requires non-empty edits[]; a no-op space edit satisfies schema for diff-only replay.
export function createPlaceholderEditArgs(path: string): PiEditArgs {
    return { path, edits: [{ oldText: " ", newText: " " }] };
}

export function prepareCursorEditArguments(input: unknown): PiEditArgs | unknown {
    const args = getRecord(input);
    return normalizeCursorEditArgsForPi(args) ?? input;
}
