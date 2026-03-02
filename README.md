# claude-hooks

English | [中文](README-CN.md)

PreToolUse hooks for Claude Code on Windows. These hooks intercept Bash commands and file writes before execution, automatically fixing common Git Bash/MSYS2 mistakes and enforcing code style preferences. No more `> nul` creating undeletable files, no more `python3` hitting the Windows Store alias, no more `dir /b` silently treating a flag as a path, no more emoji in code, no more POSIX paths breaking Read/Edit tools.

## Fixes

| Fix | Trigger | Tier | Action |
|-----|---------|------|--------|
| Null redirect | `> nul`, `2> nul` | Auto-fix | Rewrite to `> /dev/null` |
| Python3 alias | `python3 ...` | Auto-fix | Rewrite to `python` |
| PowerShell quoting | `pwsh -Command "$..."` | Auto-fix | Swap to single quotes |
| MSYS2 drive paths | `/c/Work/...` | Auto-fix | Rewrite to `C:/Work/...` |
| Reserved names | `> con`, `> prn`, `touch aux.txt` | Block | Reject -- undeletable files |
| Commit messages | Co-Authored-By, emoji, "Generated with" | Block | Reject with message |
| Doubled flags | `tasklist //fi` | Block | Suggest single `/` |
| Backslash paths | `C:\Users\...` | Block | Suggest `C:/Users/...` |
| UNC paths | `\\server\share\...` | Block | Suggest `//server/share/...` |
| WSL invocation | `wsl ls`, `wsl.exe cat` | Block | Reject -- you're in Git Bash, not WSL; full path allowed |
| WSL mount paths | `/mnt/c/Users/...` | Block | Suggest `C:/Users/...` |
| `dir /b` in bash | `dir /b path` | Auto-fix | Rewrite to `ls -1 path` |
| `dir /flag` in pwsh | `pwsh -Command "dir /b ..."` | Block | Suggest `Get-ChildItem` equivalent |
| Emoji in files | Write/Edit with emoji | Block | Reject with message |
| Tool path POSIX | `/c/Work/...` in Read/Write/Edit/Glob/Grep | Auto-fix | Rewrite to `C:\Work\...` |

## Installation

### Quick install (recommended)

```
npm install -g claude-hooks-win
claude-hooks-win init
```

Or without global install:

```
npx -y claude-hooks-win init
```

This copies `config.sample.json` to `~/.claude/hooks/` and adds hook configuration to `~/.claude/settings.json`.

### Project-local (single project, good for testing)

```
npx -y claude-hooks-win init --project /path/to/your/project
npx -y claude-hooks-win init --project .
```

This writes configuration to `<project>/.claude/settings.local.json`. Only affects that one project.

### Manual configuration

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{"type": "command", "command": "claude-hooks-win"}]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [{"type": "command", "command": "claude-hooks-win"}]
      },
      {
        "matcher": "Read|Write|Edit|Glob|Grep",
        "hooks": [{"type": "command", "command": "claude-hooks-win"}]
      }
    ]
  }
}
```

## Reviewing the fixups log

Both auto-fixes and tier-2 suggestions are logged to `~/.claude/hooks/fixups.log`.

```
cat ~/.claude/hooks/fixups.log
```

Each line is a JSON object with:

| Field | Description |
|-------|-------------|
| `time` | Human-readable timestamp (`2026-02-18 13:15:51`) |
| `type` | `autofix` (tier 1, silently applied) or `suggest` (tier 2, blocked) |
| `fix` | What was fixed or suggested |
| `cwd` | Working directory (identifies the project) |
| `original` | The original command |
| `proposed` | The fixed/suggested command |

The log auto-trims to 250 lines when it exceeds 500, so it won't grow unbounded.

## Updating

```
npm update -g claude-hooks-win
```

## Configuration

Individual checks can be enabled or disabled via `config.json` in the hooks directory (`~/.claude/hooks/config.json` for global installs, `<project>/.claude/hooks/config.json` for project installs).

To get started, copy the sample config:

```
cp ~/.claude/hooks/config.sample.json ~/.claude/hooks/config.json
```

Then edit `config.json` to toggle checks. Each key is a check ID mapped to `true` (enabled) or `false` (disabled). Missing keys use built-in defaults. If there is no `config.json`, all safety checks run and style checks are skipped (same as always).

### Check reference

| Check ID | Description | Default | Tier |
|----------|-------------|---------|------|
| `nul_redirect` | Rewrite `> nul` to `> /dev/null` | on | auto-fix |
| `msys2_drive_paths` | Rewrite `/c/...` to `C:/...` | on | auto-fix |
| `python3` | Rewrite `python3` to `python` | on | auto-fix |
| `dir_windows_flags` | Rewrite `dir /b` to `ls -1` | on | auto-fix |
| `pwsh_quoting` | Fix pwsh double-quote to single-quote | on | auto-fix |
| `backslash_paths` | Block `C:\` backslash paths | on | block |
| `unc_paths` | Block `\\server` UNC paths | on | block |
| `wsl_paths` | Block `/mnt/c/` WSL-style paths | on | block |
| `reserved_names` | Block redirects to CON, PRN, etc. | on | block |
| `doubled_flags` | Block `//flag` doubled-slash flags | on | block |
| `dir_in_pwsh` | Block `dir /flag` inside pwsh | on | block |
| `wsl_invocation` | Block bare `wsl` commands | on | block |
| `git_commit_attribution` | Block Co-Authored-By in commits | off | block |
| `git_commit_generated` | Block "Generated with" in commits | off | block |
| `git_commit_emoji` | Block emoji in commit messages | off | block |
| `file_content_unicode` | Block emoji/unicode in file writes | off | block |
| `tool_path_posix` | Rewrite `/c/...` to `C:\...` in Read/Write/Edit/Glob/Grep paths | on | auto-fix |

Safety checks (default on) prevent real mistakes that break commands or create undeletable files. Style checks (default off) enforce preferences -- enable the ones you want.

See `config.sample.json` for descriptions of each check.

## How it works

Claude Code hooks receive a JSON object on stdin with `tool_name` and `tool_input`. The hook can:

- **Exit 0** with no output: allow the command unchanged
- **Exit 0** with JSON on stdout: rewrite the command via `updatedInput`
- **Exit 2** with a message on stderr: block the command and show the message to Claude
