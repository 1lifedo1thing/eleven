# MCP tools

Every agent you run in Eleven gets its tools over the [Model Context Protocol](https://modelcontextprotocol.io). Eleven hands each agent session up to four tool servers, chosen under **Settings > Agents > Tools agents get**:

| Server | Setting | What it gives the agent |
| --- | --- | --- |
| `eleven` | Eleven | Drive the window and annotate the project: open functions, switch views, rename, notes, comments, bookmarks, patches, GPU profiles. |
| `eleven-rea` | Analysis tools (REA) | REA's analysis tools on the open file, minus the ones that would write names, comments or bookmarks around Eleven's project. |
| `ida` | IDA Pro | Your IDA MCP plugin, if `REA_IDA_MCP_CONFIG` (or the IDA path in Settings) points at its JSON config. |
| `custom` | Add a tool server | Any MCP server command you type, such as `npx my-mcp-server`. |

The `eleven` and `eleven-rea` servers are Eleven itself, started with `--eleven-mcp` or `--rea-mcp`. Agents never need to install anything for them.

## The `eleven` server

These tools act on the file open in the window. If no file is open, every tool answers "No file is open in Eleven. Ask the user to open one."

Functions can be named by their Ghidra name (`FUN_100001234`), by a name the user or an agent gave them, or by address (`0x100001234`). Addresses are always hexadecimal with a `0x` prefix.

### Seeing what the user sees

#### `current_view`

What the user is looking at right now.

No arguments. Returns JSON:

```json
{ "file": "/Applications/Example.app", "function": "check_license", "address": "0x100003f2c", "view": "pseudocode" }
```

`function`, `address` and `view` are `null` when nothing is selected.

#### `open_function`

Shows a function in the window, on the canvas and in the workbench. Call it whenever you start talking about a function, so the user sees what you see.

| Argument | Type | Description |
| --- | --- | --- |
| `function` | string | Function name or address |

Returns `Showing <name> (<address>) to the user.`

#### `set_view`

Switches the code view.

| Argument | Type | Description |
| --- | --- | --- |
| `view` | `pseudocode` \| `assembly` \| `graph` \| `hex` | The view to show |

Only the workbench can switch views. If the user is on the home canvas, the tool says so and they keep reading pseudocode.

#### `list_marks`

Everything already written into the project for this file: renames, bookmarks, notes, line comments, code types, number formats, and the agent's own suggestions still waiting for review. Call it before renaming so you don't redo work.

No arguments. Returns one line per mark, for example:

```text
renamed 0x100003f2c to check_license
note on check_license: Compares the key against a hard-coded hash.
waiting for the user's review: Patch 0x100003f40 to 1f 20 03 d5
```

### Changing the project

These tools write to the user's Eleven project, never to the binary. Every change is logged with the agent's name and chat, and the user can undo it from the History tab or with ⌘Z.

When the user turns on the review setting (`reviewAgentEdits` in `~/Library/Application Support/Eleven/settings.json`), these edits are filed as suggestions in the Changes tab instead of being saved, and the tool answer starts with "Suggested to the user".

#### `rename_function`

| Argument | Type | Description |
| --- | --- | --- |
| `function` | string | Function name or address |
| `new_name` | string | A C identifier, like `check_license_key` |

Names that are not C identifiers are refused.

#### `add_note`

A short note on a function, shown beside its code.

| Argument | Type | Description |
| --- | --- | --- |
| `function` | string | Function name or address |
| `note` | string | The note. Empty removes it. |

#### `add_comment`

A comment on one instruction, shown at the end of that line in assembly and the graph.

| Argument | Type | Description |
| --- | --- | --- |
| `address` | string | Hexadecimal address |
| `comment` | string | The comment. Empty removes it. |

#### `bookmark`

Adds a bookmark to the sidebar.

| Argument | Type | Description |
| --- | --- | --- |
| `address` | string | Function name or hexadecimal address |
| `label` | string | Short label. Empty uses the address. |

#### `set_code_type`

Marks what the bytes at an address are, like Hopper's Modify menu. Ghidra re-reads the code and the type is replayed every time the file opens.

| Argument | Type | Description |
| --- | --- | --- |
| `address` | string | Hexadecimal address |
| `type` | string | `code`, `procedure`, `byte`, `word`, `dword`, `qword`, `cstring`, `undefined`, or empty to read it as code again |

`procedure` starts a function at the address.

#### `set_number_format`

Chooses how the number in an instruction reads in assembly. Eleven draws the format; the binary and Ghidra's database are unchanged.

| Argument | Type | Description |
| --- | --- | --- |
| `address` | string | Hexadecimal address of the instruction |
| `format` | string | `hex`, `decimal`, `char`, `offset`, `address`, or empty for Ghidra's own |

#### `propose_patch`

Suggests new bytes at an address. Patches are always suggestions: nothing is saved until the user accepts it in the Changes tab, and even then Eleven writes a patched copy, never the original file.

| Argument | Type | Description |
| --- | --- | --- |
| `address` | string | Hexadecimal address |
| `bytes` | string | Hex bytes, like `1f2003d5` or `90 90` |
| `reason` | string | One sentence on what the patch does, shown to the user |

### GPU

#### `gpu_profile`

Reads the newest GPU recording (Metal System Trace) of the open app: frame time, GPU busy time, gaps between frames, and what the numbers suggest fixing.

No arguments. Only works for `.app` bundles. If there is no recording yet, it asks the user to press **Record a GPU run** in the workbench sidebar.

## The `eleven-rea` server

This is [REA](https://github.com/morluto/rea) with a filter in front. Every REA tool passes through, with its own descriptions and server instructions, except the ones that would change names, comments or bookmarks behind the project's back. Those are hidden from the tool list, and calling them anyway returns an error that names the `eleven` tool to use:

| REA tool | Use instead |
| --- | --- |
| `set_address_name`, `set_addresses_names` | `rename_function` |
| `set_comment`, `set_inline_comment` | `add_comment` |
| `set_bookmark`, `unset_bookmark` | `bookmark` |
| `set_code_type` | `set_code_type` |

It is named `eleven-rea` so it never collides with a `rea` server the agent already has configured. Long REA calls can run for up to 30 minutes and report progress back to the agent.

See REA's [tool catalog](https://github.com/morluto/rea/blob/main/docs/mcp-contracts.md) for the tools themselves.

## Permissions

Each tool call is matched to a row on **Settings > Permissions**, where the user picks Allow, Ask or Never.

| Row | Tools |
| --- | --- |
| Read the open file | REA tools that only read: `open_binary`, `binary_overview`, `list_*`, `procedure_*`, `read_*`, `search_*`, `inspect_*`, `get_*`, `find_*`, `analyze_*`, `xrefs`, `compare_*` and similar |
| Move around the window | `open_function`, `current_view`, `set_view`, `list_marks` |
| Rename functions and variables | `rename_function` |
| Add notes, comments and bookmarks | `add_note`, `add_comment`, `bookmark`, `set_code_type`, `set_number_format` |
| Patch bytes | `propose_patch` |
| Run the app to record a GPU trace | `gpu_profile` |
| Run commands on your Mac | Everything else, including REA tools that write or run code and the agent's own tools |

Tools that only file a suggestion (`propose_patch`, and the project edits when review is on) don't ask first, since the user approves the suggestion itself.

## Privacy

- With **Settings > Privacy > Hide your name in paths** on, Eleven replaces the home folder with `~` in every answer from `eleven` and `eleven-rea`.
- With **Ask before sending a whole file** on, Eleven asks before a tool reads the entire open file, such as `read_bytes` over its full length or a non-REA tool given its path.

## How the `eleven` server reaches the window

The `eleven` server runs inside the agent's process tree, so it talks to the window over a local socket. The window listens at `~/Library/Caches/eleven/bridge-<pid>.sock` (a named pipe on Windows) and passes three variables to the server:

| Variable | Value |
| --- | --- |
| `ELEVEN_BRIDGE` | The socket path |
| `ELEVEN_AGENT` | The agent's name, used as the author of its edits |
| `ELEVEN_CHAT` | The chat the agent belongs to |

Each call is one line of JSON each way:

```json
{ "id": 1, "tool": "rename_function", "args": { "function": "FUN_100003f2c", "new_name": "check_license" }, "from": { "agent": "Claude", "chat": "c_123" } }
```

```json
{ "id": 1, "ok": true, "text": "Renamed FUN_100003f2c to check_license in the user's project." }
```

Errors come back as `{ "id": 1, "ok": false, "error": "..." }` and reach the agent as an MCP tool error.

## Adding a tool

1. Add the name to `BridgeTool` and `TOOLS` in [app/src/bridge/protocol.ts](../app/src/bridge/protocol.ts).
2. Register it with a description and input schema in [app/src/bridge/mcp.ts](../app/src/bridge/mcp.ts).
3. Handle it in [app/src/bridge/handlers.ts](../app/src/bridge/handlers.ts). Project changes go through `agentEdit` or `propose` so they are logged and undoable.
4. Give it a permission row in `TOOL_KIND` in [app/src/agents/permissions.ts](../app/src/agents/permissions.ts).
5. Cover it in `tests/m4-bridge.test.tsx` and document it here.
