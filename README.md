# pi-compact-model

Choose a separate model and thinking level for Pi context compaction without changing the main conversation model.

## What it does to your setup

You can predict exactly what this extension touches:

| Question | Answer |
|---|---|
| Do I have to configure anything? | No. Without configuration, compaction behaves exactly like stock Pi: same main model, same thinking level, same native `compact()`. The only visible addition is a one-line startup notification and the `/compact-model` command. |
| What changes once I configure a model? | Only the model and thinking level used to generate compaction summaries. Nothing else. |
| Does it change my main conversation model? | Never. The main model, its thinking level, and normal replies are untouched. |
| Does it change when compaction triggers? | No. Thresholds still come from the main model and Pi settings. Overflow recovery and `/tree` branch summaries keep Pi's behavior. |
| Does it rewrite or reformat summaries? | No. Summaries come from Pi's native `compact()`: same format, boundaries, recent-message retention, split-turn handling, file tracking, and usage accounting. |
| What if the configured model breaks? | That compaction is cancelled with an explicit error. There is **no silent fallback** to the main model or any other model. Run `/compact-model` to repair it. |
| What files does it write? | Exactly one: `compact-model.json` in the Pi user directory (usually `~/.pi/agent/compact-model.json`), written atomically with mode `0600`. Delete it or pick **Follow main conversation model (default)** to return to stock behavior. |
| Does it send anything anywhere? | No telemetry. The only network call is the compaction request to the provider you selected, made through Pi's own model registry. |

In short: installing without configuring is indistinguishable from not installing, apart from the notification. Configuring replaces only the compaction model.

## Usage

By default, compaction follows the **current main conversation model and thinking level**. Both are read at each compaction, so changing them in the conversation also changes subsequent compactions. This is the default behavior, not a fallback after an error.

Run `/compact-model` to customize:

1. Search by model or provider name and select a model with configured authentication.
2. Select a supported thinking level. The previous level (or the current main conversation level in default mode) is preselected when supported; otherwise `medium`, then the first available level. Models without reasoning support are saved with `off`.
3. Confirm to save globally. Press Esc at either step to keep the previous configuration.

Select **Follow main conversation model (default)** to restore the default behavior. This removes the saved override and skips thinking-level selection.

The selector title shows the current configuration. Overrides apply globally across projects, sessions, reloads, and restarts. Other running sessions read changes at their next compaction. In default mode, each session follows its own main model and thinking level.

A non-blocking notification shows the active mode at session startup, including after `/reload` or session replacement. Default mode also points to `/compact-model`; configured mode shows the saved model and thinking level.

### No automatic fallback

Automatic threshold compaction, manual `/compact`, and overflow recovery all use the selected mode. **Once you configure a separate model, it is used strictly.** A missing model, missing authentication, unsupported thinking level, damaged configuration, or failed model call reports an error and cancels that compaction. The extension never silently switches to the main model or another model. Use `/compact-model` to repair the configuration or explicitly restore the default.

### Native compaction logic

The extension changes the model and thinking level passed to Pi's native `compact()`. Pi still handles summary generation, summary format, compaction boundaries, recent-message retention, split-turn summaries, file tracking, and usage accounting. The extension handles configuration, validation, notifications, handoff coordination, and carrying forward file records from its own and legacy `compact-suit` summaries. Default mode is not a bypass of the extension.

Success is reported only after the compaction is saved. Summary `details` record `compactModel`, `provider`, `model`, `thinkingLevel`, and `reason`; token usage is stored in `usage`.

## Installation

```bash
pi install npm:@runminton/pi-compact-model
```

Run `/reload` in existing terminals. The command requires an interactive terminal; non-interactive compaction still uses the global configuration.

Use independently or with `27-pi-compact-handoff`. Together, handoff runs before compaction regardless of extension load order. Do not load the legacy `24-compact-suit` at the same time.

The extensions coordinate through the synchronous `compact-handoff:before-compact` event. Before generating a summary, the model extension emits `{ event, ctx, gate }`; the handoff extension can set `gate.cancel` or `gate.handoffEntryId`. The handoff extension also handles native Pi compaction events. This protocol only gates handoff, not model selection, and requires no shared package.

## Verification

Requires Pi 1.4.0 or a compatible version on PATH.

```bash
npm install --ignore-scripts --legacy-peer-deps
npm run check
npm test
```

Tests exercise real selector input and compaction event interfaces using Pi's actual summary logic. Only provider responses are simulated; no paid requests are made.

With `expect` installed, run the repeatable terminal check using an isolated user directory and a fake provider (no model requests):

```bash
expect scripts/selector-smoke.exp "$(mktemp -d /tmp/pi-compact-selector.XXXXXX)"
```

Checks startup notifications, slash command registration, search, thinking-level selection, save, cancel, `/reload`, persistence across processes, and restoring default mode. ANSI terminal logs are saved in the specified temporary directory.
