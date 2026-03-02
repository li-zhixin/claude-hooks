# claude-hooks

[English](README.md) | 中文

适用于 Windows 上 Claude Code 的 PreToolUse 钩子。这些钩子在命令执行前拦截 Bash 命令和文件写入，自动修复常见的 Git Bash/MSYS2 错误并强制执行代码风格偏好。不再有 `> nul` 创建无法删除的文件，不再有 `python3` 触发 Windows 应用商店别名，不再有 `dir /b` 把参数当路径，不再有代码中的 emoji，不再有 POSIX 路径导致 Read/Edit 工具出错。

## 修复列表

| 修复项 | 触发条件 | 级别 | 处理方式 |
|--------|----------|------|----------|
| 空设备重定向 | `> nul`, `2> nul` | 自动修复 | 改写为 `> /dev/null` |
| Python3 别名 | `python3 ...` | 自动修复 | 改写为 `python` |
| PowerShell 引号 | `pwsh -Command "$..."` | 自动修复 | 替换为单引号 |
| MSYS2 驱动器路径 | `/c/Work/...` | 自动修复 | 改写为 `C:/Work/...` |
| 保留设备名 | `> con`, `> prn`, `touch aux.txt` | 拦截 | 拒绝——会创建无法删除的文件 |
| 提交信息 | Co-Authored-By、emoji、"Generated with" | 拦截 | 拒绝并提示 |
| 双斜杠参数 | `tasklist //fi` | 拦截 | 建议使用单 `/` |
| 反斜杠路径 | `C:\Users\...` | 拦截 | 建议使用 `C:/Users/...` |
| UNC 路径 | `\\server\share\...` | 拦截 | 建议使用 `//server/share/...` |
| WSL 调用 | `wsl ls`, `wsl.exe cat` | 拦截 | 拒绝——当前环境是 Git Bash 而非 WSL；允许使用完整路径 |
| WSL 挂载路径 | `/mnt/c/Users/...` | 拦截 | 建议使用 `C:/Users/...` |
| bash 中的 `dir /b` | `dir /b path` | 自动修复 | 改写为 `ls -1 path` |
| pwsh 中的 `dir /flag` | `pwsh -Command "dir /b ..."` | 拦截 | 建议使用 `Get-ChildItem` 等价命令 |
| 文件中的 Emoji | Write/Edit 包含 emoji | 拦截 | 拒绝并提示 |
| 工具路径 POSIX | Read/Write/Edit/Glob/Grep 中的 `/c/Work/...` | 自动修复 | 改写为 `C:\Work\...` |

## 安装

### 快速安装（推荐）

```
npm install -g claude-hooks-win
claude-hooks-win init
```

或者不全局安装：

```
npx -y claude-hooks-win init
```

将 `config.sample.json` 复制到 `~/.claude/hooks/` 并在 `~/.claude/settings.json` 中添加钩子配置。

### 项目级安装（单个项目，适合测试）

```
npx -y claude-hooks-win init --project /path/to/your/project
npx -y claude-hooks-win init --project .
```

配置写入 `<project>/.claude/settings.local.json`，仅影响该项目。

### 手动配置

在 `~/.claude/settings.json` 中添加：

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

## 查看修复日志

自动修复和拦截建议都会被记录到 `~/.claude/hooks/fixups.log`。

```
cat ~/.claude/hooks/fixups.log
```

每行是一个 JSON 对象，包含以下字段：

| 字段 | 说明 |
|------|------|
| `time` | 可读时间戳（`2026-02-18 13:15:51`） |
| `type` | `autofix`（一级，静默应用）或 `suggest`（二级，已拦截） |
| `fix` | 修复或建议的内容 |
| `cwd` | 工作目录（标识项目） |
| `original` | 原始命令 |
| `proposed` | 修复/建议后的命令 |

日志超过 500 行时自动裁剪到 250 行，不会无限增长。

## 更新

```
npm update -g claude-hooks-win
```

## 配置

可以通过钩子目录中的 `config.json` 启用或禁用各项检查（全局安装为 `~/.claude/hooks/config.json`，项目安装为 `<project>/.claude/hooks/config.json`）。

首先复制示例配置：

```
cp ~/.claude/hooks/config.sample.json ~/.claude/hooks/config.json
```

然后编辑 `config.json` 切换检查项。每个键是检查 ID，值为 `true`（启用）或 `false`（禁用）。缺失的键使用内置默认值。如果没有 `config.json`，所有安全检查会运行，风格检查会跳过（与之前一致）。

### 检查项参考

| 检查 ID | 说明 | 默认 | 级别 |
|---------|------|------|------|
| `nul_redirect` | 将 `> nul` 改写为 `> /dev/null` | 开启 | 自动修复 |
| `msys2_drive_paths` | 将 `/c/...` 改写为 `C:/...` | 开启 | 自动修复 |
| `python3` | 将 `python3` 改写为 `python` | 开启 | 自动修复 |
| `dir_windows_flags` | 将 `dir /b` 改写为 `ls -1` | 开启 | 自动修复 |
| `pwsh_quoting` | 修复 pwsh 双引号为单引号 | 开启 | 自动修复 |
| `backslash_paths` | 拦截 `C:\` 反斜杠路径 | 开启 | 拦截 |
| `unc_paths` | 拦截 `\\server` UNC 路径 | 开启 | 拦截 |
| `wsl_paths` | 拦截 `/mnt/c/` WSL 路径 | 开启 | 拦截 |
| `reserved_names` | 拦截重定向到 CON、PRN 等 | 开启 | 拦截 |
| `doubled_flags` | 拦截 `//flag` 双斜杠参数 | 开启 | 拦截 |
| `dir_in_pwsh` | 拦截 pwsh 中的 `dir /flag` | 开启 | 拦截 |
| `wsl_invocation` | 拦截直接 `wsl` 命令 | 开启 | 拦截 |
| `git_commit_attribution` | 拦截提交中的 Co-Authored-By | 关闭 | 拦截 |
| `git_commit_generated` | 拦截提交中的 "Generated with" | 关闭 | 拦截 |
| `git_commit_emoji` | 拦截提交信息中的 emoji | 关闭 | 拦截 |
| `file_content_unicode` | 拦截文件写入中的 emoji/unicode | 关闭 | 拦截 |
| `tool_path_posix` | 将 Read/Write/Edit/Glob/Grep 中的 `/c/...` 改写为 `C:\...` | 开启 | 自动修复 |

安全检查（默认开启）防止真实错误——命令执行失败或创建无法删除的文件。风格检查（默认关闭）强制执行个人偏好——按需启用。

详见 `config.sample.json` 中各检查项的说明。

## 工作原理

Claude Code 钩子通过 stdin 接收包含 `tool_name` 和 `tool_input` 的 JSON 对象。钩子可以：

- **Exit 0** 无输出：允许命令原样执行
- **Exit 0** 输出 JSON 到 stdout：通过 `updatedInput` 改写命令
- **Exit 2** 输出消息到 stderr：拦截命令并向 Claude 显示消息
