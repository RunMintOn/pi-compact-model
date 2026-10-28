# pi-compact-model

Choose a separate model and thinking level for Pi context compaction without changing the main conversation model.

## Usage

By default, compaction follows the **current main conversation model and thinking level**. Both are read at each compaction, so changing them in the conversation also changes subsequent compactions. This is the default behavior, not a fallback after an error.

Run `/compact-model` to customize:

1. Search by model or provider name and select a model with configured authentication.
2. Select a supported thinking level. The previous level (or the current main conversation level in default mode) is preselected when supported; otherwise `medium`, then the first available level. Models without reasoning support are saved with `off`.
3. Confirm to save globally. Press Esc at either step to keep the previous configuration.

Select **Follow main conversation model (default)** to restore the default behavior. This removes the saved override and skips thinking-level selection.

The selector title shows the current configuration. Overrides are stored in `compact-model.json` in the Pi user directory (usually `~/.pi/agent/compact-model.json`). They apply globally across projects, sessions, reloads, and restarts. Other running sessions read changes at their next compaction. In default mode, each session follows its own main model and thinking level.

A non-blocking notification shows the active mode at session startup, including after `/reload` or session replacement. Default mode also points to `/compact-model`; configured mode shows the saved model and thinking level.

### No automatic fallback

Automatic threshold compaction, manual `/compact`, and overflow recovery all use the selected mode. **Once you configure a separate model, it is used strictly.** A missing model, missing authentication, unsupported thinking level, damaged configuration, or failed model call reports an error and cancels that compaction. The extension never silently switches to the main model or another model. Use `/compact-model` to repair the configuration or explicitly restore the default.

### Native compaction logic

The extension changes the model and thinking level passed to Pi's native `compact()`. Pi still handles summary generation, summary format, compaction boundaries, recent-message retention, split-turn summaries, file tracking, and usage accounting. The extension handles configuration, validation, notifications, handoff coordination, and carrying forward file records from its own and legacy `compact-suit` summaries. Default mode is not a bypass of the extension.

Compaction thresholds still depend on the main model and Pi settings. `/tree` branch summaries are not overridden.

Success is reported only after the compaction is saved. Summary `details` record `compactModel`, `provider`, `model`, `thinkingLevel`, and `reason`; token usage is stored in `usage`.

## Installation and composition

```bash
pi install /path/to/26-pi-compact-model
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
