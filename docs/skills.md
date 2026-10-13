# Skills

Skills are reverse-engineering playbooks. Type `/` in the composer or open the ⌘K palette to pick one and Eleven sends its instructions to whichever agent the chat uses, followed by anything you typed after it. They work with every agent, because they only rely on the [MCP tools](mcp-tools.md) Eleven gives each one.

## Built in

| Skill | Shown as | What it does |
| --- | --- | --- |
| `first-look` | First look | What the program is, where it starts, and the few functions worth reading first |
| `explain-function` | Explain a function | What a function does, its inputs and outputs, who calls it and what it calls |
| `find` | Find | Finds the code behind a plain-English description, like the license check or the parser, and opens it |
| `name-functions` | Name functions | Renames the `FUN_` functions worth naming, each with a one-line note |
| `trace-feature` | Trace a feature | Follows a feature from the button you press to the code that does the work |
| `network-map` | Map the network code | Lists what the app talks to and the code that does it |
| `decompile` | Clean up pseudocode | Rewrites a function into readable C with types and names |
| `shader-check` | Check a shader | Reads the app's Metal shaders and GPU recordings and points out what makes them slow |

The source of each one is in [app/skills/](../app/skills/). Turn any of them off under **Settings > Skills**.

## Writing your own

A skill is a folder with a `SKILL.md` inside:

```markdown
---
name: crypto-audit
description: Find the crypto a program uses and check the keys and modes.
---

# Crypto audit

1. Call `current_view` (eleven) to see what the user has open.
2. Search strings and imports for crypto libraries with the REA tools.
3. Open each function you discuss with `open_function` (eleven).
4. Leave a note on every function that handles a key with `add_note` (eleven).
```

Put the folder in `~/Library/Application Support/Eleven/skills/`, or choose another folder under **Settings > Skills > Skills folder**. **New skill…** on the same page starts one for you. Eleven reads the folder the next time it lists skills.

- `name` is how the skill is listed. A skill of yours with the same name as a built-in one replaces it.
- `description` is the one line shown under it.
- The body is sent as is, up to 8,000 characters.

Tips that make a playbook work across agents:

- Name the tool and its server, like "`rename_function` (eleven)", so agents with many servers pick the right one.
- Open functions with `open_function` as you go, so the user follows along.
- Write findings into the project with notes, comments and renames rather than only in the chat. They survive reopening and the user can undo them.
- Patch through `propose_patch`, which the user reviews.
