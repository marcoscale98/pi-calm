# pi-calm

> **This is a fork** of [`JesseZhang97/pi-calm`](https://github.com/JesseZhang97/pi-calm) by Jesse Zhang (MIT License, see [LICENSE](LICENSE)), also published on npm as [`pi-calm`](https://www.npmjs.com/package/pi-calm). This fork adds package metadata, documentation, and issue-driven extension changes.

A calmer way to read [Pi](https://github.com/badlogic/pi-mono) while it works.

**pi-calm** keeps the conversation and Pi's `Working...` status easy to follow, while quietly tucking away tool chatter and optional thinking. It changes only what you see in the terminal—tool execution, model context, and session data stay untouched.

## What stays visible

Calm is **on by default**:

| Stays visible | Quietly hidden (presentation only) |
| --- | --- |
| Genuine user prompts | Thinking / CoT blocks (unless `/calm thinking`) |
| Genuine assistant text | All non-skill tool shells (built-in and user-defined) |
| Pi's native `Working...` row (always on, cannot be disabled) | Operational user rows marked with `U+2063` envelopes |
| `read` tool rows targeting `SKILL.md` (with `/calm skills`) | Skill reads by default |

Hidden content remains in the session and comes back when you turn Calm off. `/export` and `/share` briefly restore Pi's normal rendering so exported content remains complete.

## Install

### Option A — GitHub package (recommended)

```sh
pi install git:github.com/marcoscale98/pi-calm
```

### Option B — Local path

```sh
pi install ./path/to/pi-calm
```

### Option C — Global extension copy

```sh
mkdir -p ~/.pi/agent/extensions
cp -R extensions/calm ~/.pi/agent/extensions/calm
```

### Option D — One-shot test

```sh
pi -e ./extensions/calm/index.ts
```

The upstream release is also on npm (`pi install npm:pi-calm`); this fork is not published there.

Restart Pi (or `/reload`) after install. Project-local installs require project trust.

## Usage

```text
/calm on                    # Calm on, thinking and skill reads hidden
/calm thinking              # Calm on, toggle thinking / CoT
/calm skills                # Calm on, toggle read rows targeting SKILL.md
/calm no-built-ins          # Calm on, hide only built-in tool rows
/calm thinking skills       # toggle thinking and skill reads
/calm no-built-ins thinking # toggle built-in hiding and thinking
/calm no-built-ins skills   # toggle built-in hiding and skill reads
/calm off                   # restore ordinary transcript
```

Pi provides argument completion for these command forms after typing `/calm`
followed by a space. `thinking`, `skills`, and `no-built-ins` toggle
independently and preserve the other settings while Calm is active; either
order is supported for combined toggles, such as `no-built-ins skills` and
`skills no-built-ins`.

`Working...` is always forced visible and cannot be turned off while this extension is loaded.

There are intentionally no bare `/calm`, `/calm thinking off`, or alias forms; use
`on`, `thinking`, `skills`, `no-built-ins`, their supported combinations, and
`off`.

Preference is written to:

```text
~/.pi/agent/calm
```

Contents:

| File contents | Meaning |
| --- | --- |
| `on` | Calm on, thinking and skill reads hidden (default) |
| `on thinking` | Calm on, thinking / CoT shown, skill reads hidden |
| `on skills` | Calm on, thinking hidden, `SKILL.md` reads shown |
| `on no-built-ins` | Calm on, only fixed-name built-in tool rows hidden |
| `on thinking skills` | Calm on, thinking / CoT and `SKILL.md` reads shown |
| `on no-built-ins thinking` | Built-in tool rows hidden and thinking shown |
| `on no-built-ins skills` | Built-in tool rows hidden and `SKILL.md` reads shown |
| `on no-built-ins thinking skills` | Built-in tool rows hidden, thinking and `SKILL.md` reads shown |
| `off` | Calm off; all optional toggles reset |

Missing file → defaults to **on**. Override the path with `PI_CALM_PREFERENCE_PATH`.
The canonical persisted values are `on`, `on thinking`, `on skills`,
`on no-built-ins`, their combinations, and `off` (one line; trailing whitespace
is ignored). Existing `on+thinking`, `on thinking:on`, and `on thinking=on` values
remain compatible. The `no-built-ins` mode always uses this fixed denylist:
`read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find`, and `ls`.
A `read` targeting `SKILL.md` remains visible when `skills` is also enabled;
other built-in rows stay hidden. Tool names outside this list remain visible,
including tools added by Pi or extensions in the future.

Preference is restored on every `session_start` (startup, resume, new, fork, reload).

## Operational rows (optional)

Any text-only user message that begins with one of these envelopes can be zero-height under Calm:

```text
U+2063CALM_HIDE: <body>                          # general
U+2063FIRSTMATE_OP: v1 <kind>: <body>            # firstmate-compatible
[fm-from-firstmate]U+2063<body>                  # firstmate routing carrier
U+2063Supervisor escalate (...                   # narrow legacy shape
```

Helpers:

```ts
import {
  encodeCalmHideInput,
  encodeFirstmateOperationalInput,
  classifyOperationalText,
} from "./extensions/calm/lib/operational-input.ts";

// In another extension that injects follow-up / watcher text:
pi.sendUserMessage(encodeCalmHideInput("watcher: task finished"), {
  deliverAs: "followUp",
});
```

Near misses stay visible (quoted markers, plain `FIRSTMATE_OP:` without `U+2063`, ordinary text before the marker, image-bearing messages).

## Supported limits

Pi has no global transcript filter. These stay visible even with Calm on:

- User-bash (`!` / `!!`)
- Skill-invocation / compaction / branch summary rows
- Custom messages and entries emitted by third-party extensions
- Generic system / cache / command notices

Adapters probe the exact Pi APIs they patch (`AssistantMessageComponent.updateContent`, `ToolExecutionComponent.render`, `InteractiveMode.addMessageToChat`, `InteractiveMode.setWorkingVisible`). The `ToolExecutionComponent` patch blanks every non-skill tool row by default, including user-defined tools, even if another extension wins Pi's first-wins tool ownership (e.g. `pi-tool-display`). With `/calm no-built-ins`, only the fixed built-in-name denylist is blanked; unknown and extension-provided tool names remain visible. Any tool named `read` targeting `SKILL.md` remains available with `/calm skills`. If a future Pi removes a seam, that adapter logs a diagnostic and skips; `/calm` and the rest keep working. No numeric version gate.

Upstream was verified against Pi **0.81.1 – 0.82.1**. This fork's `/calm skills` behavior was manually verified against Pi **0.84.2**.

## Layout

```text
package.json                 # pi package manifest
extensions/calm/
  index.ts                   # /calm command, tool wrappers, preference
  lib/
    visibility.ts            # presentation policy + preference + legacy entry renderer
    operational-input.ts     # pure TS marker encode/classify
    assistant-layout.ts      # thinking/CoT presentation adapter
    tool-execution-layout.ts # all tool-row zero-height adapter
    operational-user-layout.ts  # operational user-row zero-height adapter
    working-lock.ts          # force Working... always visible
tests/self-check.ts          # lightweight presentation-helper self-check
```

## Credits

Upstream: [`JesseZhang97/pi-calm`](https://github.com/JesseZhang97/pi-calm) by Jesse Zhang.

Upstream's behavior and presentation contracts follow firstmate's Calm docs:

- [docs/calm.md](https://github.com/kunchenguid/firstmate/blob/main/docs/calm.md)
- [docs/calm-mode-feasibility.md](https://github.com/kunchenguid/firstmate/blob/main/docs/calm-mode-feasibility.md)

Standalone packaging, pure-TS operational markers, and Pi-agent-dir preference storage are upstream's adaptations.
