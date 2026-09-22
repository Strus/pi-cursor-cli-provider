import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { win32 } from "node:path";

export interface CursorAgentInvocation {
    command: string;
    args: string[];
    env: NodeJS.ProcessEnv;
}

interface CursorAgentResolutionOptions {
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    fileExists?: (path: string) => boolean;
}

interface WindowsAgentCommand {
    command: string;
    powershellScript?: string;
}

function getEnvironmentValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
    const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    return key ? env[key] : undefined;
}

function resolveWindowsAgentCommand(
    path: string,
    fileExists: (path: string) => boolean,
): WindowsAgentCommand | undefined {
    const extension = win32.extname(path).toLowerCase();

    if (extension === ".exe" || extension === ".com") {
        return fileExists(path) ? { command: path } : undefined;
    }

    if (extension === ".ps1") {
        return fileExists(path) ? { command: path, powershellScript: path } : undefined;
    }

    if (extension === ".cmd" || extension === ".bat") {
        if (!fileExists(path)) return undefined;
        const powershellScript = `${path.slice(0, -extension.length)}.ps1`;
        return fileExists(powershellScript) ? { command: powershellScript, powershellScript } : { command: path };
    }

    if (extension) return fileExists(path) ? { command: path } : undefined;
    if (fileExists(path)) return { command: path };

    for (const executableExtension of [".exe", ".com"] as const) {
        const executable = `${path}${executableExtension}`;
        if (fileExists(executable)) return { command: executable };
    }

    const powershellScript = `${path}.ps1`;
    if (fileExists(powershellScript)) return { command: powershellScript, powershellScript };

    for (const scriptExtension of [".cmd", ".bat"] as const) {
        const script = `${path}${scriptExtension}`;
        if (fileExists(script)) return { command: script };
    }

    return undefined;
}

function findWindowsAgentCommand(
    agentPath: string,
    env: NodeJS.ProcessEnv,
    cwd: string,
    fileExists: (path: string) => boolean,
): WindowsAgentCommand | undefined {
    if (win32.isAbsolute(agentPath) || agentPath.includes("\\") || agentPath.includes("/")) {
        const resolvedPath = win32.isAbsolute(agentPath) ? agentPath : win32.resolve(cwd, agentPath);
        return resolveWindowsAgentCommand(resolvedPath, fileExists);
    }

    const pathDirectories = (getEnvironmentValue(env, "PATH") ?? "")
        .split(win32.delimiter)
        .map((directory) => directory.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);

    for (const directory of [cwd, ...pathDirectories]) {
        const resolved = resolveWindowsAgentCommand(win32.join(directory, agentPath), fileExists);
        if (resolved) return resolved;
    }

    return undefined;
}

export function resolveCursorAgentInvocation(
    agentPath: string,
    args: readonly string[],
    options: CursorAgentResolutionOptions = {},
): CursorAgentInvocation {
    const platform = options.platform ?? process.platform;
    const env = options.env ?? process.env;
    if (platform !== "win32") return { command: agentPath, args: [...args], env };

    const resolved = findWindowsAgentCommand(
        agentPath,
        env,
        options.cwd ?? process.cwd(),
        options.fileExists ?? existsSync,
    );
    if (!resolved?.powershellScript) {
        return { command: resolved?.command ?? agentPath, args: [...args], env };
    }

    const systemRoot = getEnvironmentValue(env, "SystemRoot");
    const powershell = systemRoot
        ? win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
        : "powershell.exe";

    return {
        command: powershell,
        args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolved.powershellScript, ...args],
        env: { ...env, CURSOR_INVOKED_AS: win32.basename(agentPath) },
    };
}

export function spawnCursorAgent(agentPath: string, args: readonly string[]) {
    const invocation = resolveCursorAgentInvocation(agentPath, args);
    return spawn(invocation.command, invocation.args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: invocation.env,
    });
}
