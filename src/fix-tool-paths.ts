/**
 * PreToolUse hook for Read, Write, Edit, Glob, and Grep tools.
 *
 * Auto-fixes POSIX-style paths (e.g. /c/Work/...) in file_path and path
 * parameters to Windows format (C:\Work\...).
 *
 * These tools expect Windows-style paths, but Claude sometimes generates
 * POSIX paths when running in Git Bash on Windows.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// ---------------------------------------------------------------------------
// Hooks directory resolution
// ---------------------------------------------------------------------------

function resolveHooksDir(): string {
  const projectDir = join(process.cwd(), '.claude', 'hooks');
  if (existsSync(join(projectDir, 'config.json'))) {
    return projectDir;
  }
  return join(homedir(), '.claude', 'hooks');
}

const HOOKS_DIR = resolveHooksDir();
const FIXUPS_LOG = join(HOOKS_DIR, 'fixups.log');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

let _configCache: Record<string, boolean> | null = null;

function _loadConfig(): Record<string, boolean> {
  if (_configCache !== null) return _configCache;

  const configPath = join(HOOKS_DIR, 'config.json');
  _configCache = {};
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw)) {
        if (!k.startsWith('_') && typeof v === 'boolean') {
          _configCache[k.toLowerCase()] = v as boolean;
        }
      }
    }
  } catch {
    // Missing file or invalid JSON — use defaults
  }
  return _configCache;
}

function _isEnabled(checkId: string, dflt: boolean = true): boolean {
  const config = _loadConfig();
  if (checkId in config) return config[checkId];
  return dflt;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const MAX_LOG_LINES = 500;
const TRIM_TO_LINES = 250;

function _trimLogIfNeeded(): void {
  try {
    const lines = readFileSync(FIXUPS_LOG, 'utf-8').split('\n');
    if (lines.length > MAX_LOG_LINES) {
      writeFileSync(FIXUPS_LOG, lines.slice(-TRIM_TO_LINES).join('\n') + '\n', 'utf-8');
    }
  } catch {
    // File doesn't exist yet — nothing to trim
  }
}

function _logEntry(tool: string, original: Record<string, string>, proposed: Record<string, string>): void {
  mkdirSync(dirname(FIXUPS_LOG), { recursive: true });
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const entry = {
    time,
    type: 'autofix',
    fix: `converted POSIX path to Windows path for ${tool}`,
    tool,
    original,
    proposed,
  };
  try {
    let existing = '';
    try { existing = readFileSync(FIXUPS_LOG, 'utf-8'); } catch { /* new file */ }
    writeFileSync(FIXUPS_LOG, existing + JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Best-effort logging
  }
  _trimLogIfNeeded();
}

// ---------------------------------------------------------------------------
// Path conversion
// ---------------------------------------------------------------------------

// Map of tool name -> path parameter field names
const PATH_FIELDS: Record<string, string[]> = {
  Read:  ['file_path'],
  Write: ['file_path'],
  Edit:  ['file_path'],
  Glob:  ['path'],
  Grep:  ['path'],
};

/**
 * Convert POSIX-style drive path to Windows path.
 * /c/Work/Source/... -> C:\Work\Source\...
 */
function posixToWindows(p: string): string {
  const m = p.match(/^\/([a-zA-Z])\/(.*)/);
  if (m) {
    return m[1].toUpperCase() + ':\\' + m[2].replace(/\//g, '\\');
  }
  return p;
}

// ---------------------------------------------------------------------------
// Exported entry point
// ---------------------------------------------------------------------------

export function runFixToolPaths(inputData: Record<string, unknown>): void {
  if (!_isEnabled('tool_path_posix', true)) return;

  const toolName = (inputData.tool_name as string) || '';
  const toolInput = (inputData.tool_input as Record<string, unknown>) || {};

  const fields = PATH_FIELDS[toolName];
  if (!fields) return;

  let changed = false;
  const updated: Record<string, unknown> = { ...toolInput };
  const originalPaths: Record<string, string> = {};
  const proposedPaths: Record<string, string> = {};

  for (const field of fields) {
    const val = toolInput[field];
    if (typeof val === 'string' && /^\/[a-zA-Z]\//.test(val)) {
      const fixed = posixToWindows(val);
      updated[field] = fixed;
      originalPaths[field] = val;
      proposedPaths[field] = fixed;
      changed = true;
    }
  }

  if (changed) {
    _logEntry(toolName, originalPaths, proposedPaths);
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        updatedInput: updated,
        additionalContext: `Hook auto-fixed: converted POSIX path to Windows path for ${toolName}`,
      },
    };
    process.stdout.write(JSON.stringify(output));
  }
}
