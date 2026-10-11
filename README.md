# dsh-agentbox

Mobile and small-screen fixes for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) web shell, packaged as a **plugin** rather than a patch — so it survives DSH updates.

Born from running DSH as an always-on agent box driven mostly from a phone. DSH's web shell is desktop-first: its entire stylesheet contains exactly **one** media query (`prefers-reduced-motion`) and **no responsive breakpoints**, so at phone widths it renders the desktop three-column layout unreflowed.

## What it does

Everything ships behind a toggle and defaults to on.

| Toggle | Effect |
|---|---|
| `mobileCss` | ≤640px only: reclaims the 56px rail, lets the open sidebar **overlay** the chat instead of squashing it, makes tapping a session auto-collapse the sidebar, and stops the transcript bleeding through the composer. |
| `usageDockCompact` | Keeps the usage indicator to one line. |
| `usageDockTerse` | Rewrites the dock to glyphs (`↓319M ·↑937K ·⚡100%`), dropping the noisy metrics. |
| `enterNewline` | On mobile, **Enter breaks the line** and the send button sends — the mobile convention. Stock DSH sends on Enter and only Shift+Enter breaks the line, which is two awkward taps on a phone keyboard. |

Plus small correctness fixes: the composer gets an opaque background so the transcript can't paint through the band around it, and the dock is set to wrap rather than clip.

## Install

```sh
# into a profile — `dsh plugin` forwards to pnpm in the profile directory
dsh plugin --profile web add github:charysrinathsc/dsh-agentbox

# then sign the profile
dsh restart
```

The package carries a `dsh.bundle.patch`, so it is composed into the profile automatically. To disable a feature, override it in the profile's `cordis.patch.yml`:

```yaml
- id: dsh-agentbox
  config:
    enterNewline: false
```

## Requirements

- DSH with a web profile
- A browser at ≤640px for the mobile work; the rest applies at any width

## Caveats, stated honestly

- **The composer still sits behind the iOS keyboard.** iOS Safari shrinks the *visual* viewport but not the *layout* viewport, so the composer's toolbar row ends up under the keyboard. A fix that resized the frame to `visualViewport.height` made this **worse** and was reverted — see `INTERNALS.md`. Treat this as an upstream issue.
- **Class names are hashed** (`_3WPZCG_toggle`, `yhfFVG_card`). They are matched by substring, which is inherently fragile. `tools/health.mjs` checks 25 load-bearing assumptions against a running instance and exits non-zero when DSH moves something.
- Developed and verified against one DSH version. It is CSS and DOM-shape dependent; expect to re-check after DSH updates.

## Development

`INTERNALS.md` is the engineering log: every measurement, dead end, and trap — including three self-inflicted regressions and what caught them. If you are changing this plugin, read it first; it will save you the same afternoons.

Two harnesses live in the sibling `tools/` directory of the origin workspace:

- `health.mjs` — do the selectors this plugin depends on still exist? (assumptions)
- `regress.mjs` — **do the features still work?** (behaviour, in WebKit, since Chromium and iOS Safari do not measure text identically)

Both exit non-zero on failure.

## License

MIT
