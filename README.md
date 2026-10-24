# delegation

A Claude Code mod that lets you pick the **model** and **effort** Claude uses when it delegates work, and keeps a **delegation note** that goes with every request.

## What it does

`/delegation` opens a pane with:

- **Agents**: model and effort for Agent tool subagents.
- **Workflow agents**: model and effort for the agents a Workflow script spawns.
- **Nested sessions**: model for sessions Claude starts.
- **Note**: free text, saved as you type and kept across sessions. Example:

  ```
  planning/review: opus high
  coding: sonnet medium
  search/reading: haiku low
  ```

Every picker defaults to `auto`, which leaves the choice to Claude.

## How it applies

- Your picks and note are added to Claude's system prompt on every request, so Claude follows them when planning agents, workflows and sessions.
- Agent calls and new sessions are forced to the model you picked (and, for agents, the effort), whatever Claude chose.
- Workflow agents are not forced: the Workflow tool has no model field, so the mod tells Claude to put your model and effort in every `agent()` call of the script.
- New sessions take no effort setting.

## Install

At the prompt of a terminal session:

```
/plugin install delegation --marketplace anas1412/claude-delegation
```

From a shell:

```bash
claude plugin install delegation --marketplace anas1412/claude-delegation
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `anas1412/claude-delegation`, then Add plugin.

## Test

```bash
claude plugin test .
```

## License

MIT
