# dsh-agentbox

Personal UX fixes for this agentbox DSH install. **A plugin, not a patch.**

## Why this exists

DSH's web shell is desktop-first. Its entire stylesheet contains **one** media
query — `prefers-reduced-motion` — and **no responsive breakpoints**. At 375px
(iPhone SE) it renders the desktop three-column layout with no reflow, which
produced, in practice:

- transcript text clipped mid-word at the right edge
- the composer floating **over** the transcript, hiding the last message
- header controls colliding, an icon drawn across the word "background"
- the usage indicator wrapping into **five stacked rows**, eating a third of
  the screen

## Why not just patch it, or fork?

**Patching `node_modules` loses the fix.** An earlier fix here was applied
directly to `dsh-usage-chart/lib/client.js`. Any `dsh plugin update` deletes it
silently, and no backup in this repo captures `node_modules`.

**Forking is worse.** DSH is a prerelease (`0.2.0-rc.2`) that moves weekly.
Forking means maintaining a mobile UI, Tailscale integration and shell layout
against a moving core, forever resolving merge conflicts. The plugin API —
slots, settings pages, `<style>` injection — is the supported extension point.
Forking is for when no such API exists.

This plugin is the third option: **versioned in git, installable, toggleable,
and unaffected by DSH upgrades.**

## Toggles

Set in `cordis.patch.yml`, or override in the profile's own
`cordis.patch.yml`. Every feature defaults to **on**.

| Toggle | Default | What it does |
|---|---|---|
| `mobileCss` | `true` | Responsive containment fixes, applied at **≤640px only** |
| `usageDockCompact` | `true` | Keeps the usage indicator on one line instead of five |

To disable one without uninstalling:

```yaml
- id: dsh-agentbox
  config:
    mobileCss: false
```

## A note on how the CSS targets things

DSH uses CSS Modules, so real class names are content-hashed:

```
_markdown_1wejo_28    _scrollable_4ub78_19    _prompt_1fs6g_70
```

The hash and line suffix change on every rebuild; the semantic prefix is the
CSS Modules local name and **is** stable. So the rules use substring selectors:

```css
[class*="_markdown_"] { overflow-wrap: anywhere !important; }
```

Hard-coding `_markdown_1wejo_28` would break on the next release. These
survive rebuilds.

**The blast radius is deliberate.** All rules are inside `@media (max-width:
640px)`, so desktop is untouched, and they only do containment — nothing
hidden, nothing clipped, nothing overlapping. They cannot make a desktop shell
*feel* native on a phone; that is what `dsh-zen-remote`'s mobile UI is for.

## Install

```sh
dsh plugin --profile web add /Users/srinathkannoju/agent/dsh-agentbox
dsh plugin --profile desktop add /Users/srinathkannoju/agent/dsh-agentbox
agentbox-restart          # from a shell, never from inside a DSH session
```

## Upstream

The `usageDockCompact` rule is arguably an upstream bug rather than a
preference: a single-line status bar should not wrap at narrow widths. Worth a
PR to [dsh-usage-chart](https://github.com/Max-Samson/dsh-usage-chart) so it
stops needing a local override at all.

## A trap worth recording: this is NOT an ES module

The client half must be wrapped in the platform's own module envelope:

```js
window.__ModuleLoader__.load({ id: "dsh-agentbox", factory: (require) => {
  var module = { exports: {} }; var exports = module.exports;
  ...
  module.exports = { name: "dsh-agentbox", apply: apply };
  return module.exports; } });
```

Shipping a plain ES module (`export function apply`) makes the bundle fail with:

```
dsh: warning: 1 entry did not activate
dsh-agentbox (dsh-agentbox): failed to import
```

The plugin then silently never mounts — no error in the browser, no clue beyond
that one line in the service log. Three things must line up:

| Requirement | Value |
|---|---|
| Wrapper | `window.__ModuleLoader__.load({ id, factory })` |
| `id` | must equal the package name in `package.json` |
| Exports | `module.exports = { name, apply }` — not ESM `export` |

`dsh.client.inject` in `package.json` lists the host packages the factory
`require`s. This plugin requires none, so it is an empty array.

To catch this without restarting the service, simulate the loader:

```sh
node -e 'global.window={__ModuleLoader__:{load:(s)=>{const m=s.factory(()=>{});
  console.log(s.id, Object.keys(m))}}};
  require("./dsh-agentbox/lib/client.js")'
```

## The other half of the trap: a bundle entry needs a SERVER half

A plugin entry is mounted **by name**:

```yaml
- insert:
    - id: dsh-agentbox
      name: dsh-agentbox      # resolved through package.json "exports"
```

A bare package name resolves to the package ROOT (`"."`). With no `"."` export
and no `lib/index.js`, resolution fails and the entry never activates:

```
dsh: warning: 1 entry did not activate
dsh-agentbox (dsh-agentbox): failed to import
```

**The plugin then does not load at all — client half included.** A perfectly
valid stylesheet never runs because a server-side file that does nothing is
missing. Requirements:

| Piece | Value |
|---|---|
| `main` / `"."` export | `./lib/index.js` |
| `lib/index.js` | server half; may be an empty `apply()` |
| `"./client"` export | `./lib/client.js` |

Both halves must exist. The client half alone is not enough.

## Which changes need a restart (and which don't)

Measured on this machine:

| Change | Action needed |
|---|---|
| **Client half** (`lib/client.js`) | **Reload the page.** Nothing else. |
| Server half (`lib/index.js`), `package.json`, `cordis.patch.yml` | `agentbox-restart` |

The client bundle is served with a **content-hash `rev`** and read **per
request**, so an edited file is picked up on the next page load. Confirmed by
editing the terse-dock code and re-measuring the *running* service with no
restart — `▸ in:195M ·out:644K` was already live.

This only holds once the plugin has activated at least once. Activation itself
is a server-side concern, which is why the missing `lib/index.js` needed a
restart while every CSS change since did not.

## The terse dock (`usageDockTerse`)

Collapsed dock, 375px viewport:

```
BEFORE  "Usage ▸ Input 192M ·Output 630K · ·Cache 99% · ·Cost $1.232 · ·flash"
        41px, two rows, clipped — "out:" cut to "·ou"

AFTER   "▸ in:192M ·out:630K"
        21px, one row, nothing clipped
```

Two parts:

- **CSS** hides the "Usage" label (33px of a 336px row) and sets
  `flex-shrink: 0` so siblings cannot squeeze the dock into truncation.
- **JS** rewrites `Input`/`Output` to `in:`/`out:`, hides Cache/Cost/Balance/the
  model chip, and hides the shell's own `93 turns / 559 steps / 258 tok`
  counters, which share the row and were the actual cause of the truncation.

### Why text matching and not selectors

The dock's metric spans carry **no class at all** — verified in the live DOM:

```
button.duc-toggle  "Usage"
span (no class)    "Input 190M"
span (no class)    "·Output 618K"
span (no class)    "·Cache 99%"
```

With no classes CSS cannot tell Input from Cost, so the JS identifies them by
**text**. That is deliberately more robust than `nth-child`, which silently
rebinds to the wrong element whenever an optional metric is absent.

The `MutationObserver` is coalesced to **one pass per animation frame** — the
dock re-renders on every token update, so it must not become a hot path while
streaming.

### Hiding the shell's counters: hide the GROUP, not its labels

First attempt hid the individual labels ("93 turns", "559 steps"). It looked
broken, and the live DOM showed why:

```
OpZ85W_root     x=-6  w=0    <- the group collapses to ZERO width
  OpZ85W_label  w=0  "94 turns 574 steps..."   <- and its text spills out
  OpZ85W_label  w=0  "197M tok·Cache hit 9..."
```

A zero-width box with visible overflow renders as a truncated `1...` plus a
stray icon at the left edge, overlapping the dock. Hiding the labels does not
remove the box. Hiding the whole group does.

Note the context meter (`y0jqnG_root`, "32%") is **also** a `*_root`, so class
alone cannot separate them — the text does:

```js
if (/\d\s*(turns?|steps?|tok)/i.test(g.textContent || '')) g.style.display = 'none'
```

### The dashed underline under the balance is intentional

`.duc-balance` carries `border-bottom: 1px dashed` with `cursor: pointer` and
`title="Balance from the official API"`. It is the plugin signalling that the
balance is clickable — not a rendering artifact. Turn it off with
`.duc-balance { border-bottom: none !important }` if you dislike it.

### Final dock contents (mobile)

```
▮›  ↓202M  ·↑666K  ·⚡ 99%  ·$1.284  ·   ◯ 34%
```

Arrows beat words: `↓`/`↑` are narrower than `In:`/`Out:` AND read faster, and
the width they freed paid for bringing cache-hit and cost back. Measured 247px
of the 336px row, one row, nothing clipped.

| Element | Mobile | Why |
|---|---|---|
| Usage word | hidden | 33px of a 336px row; the icon carries it |
| `In:` / `Out:` | **shown, capitalised** | the numbers that matter |
| Cache / Cost / model | hidden | noise on a phone |
| Balance | hidden | still in the dashboard when you tap the indicator |
| Context-pressure bar | hidden | clutter; the `34%` figure already conveys it |
| Shell turns/steps/tok | hidden | they shared the row and caused the truncation |

`.duc-root` is pinned with `flex-shrink: 0`, `max-width: 100%` and
`overflow-x: hidden` so the dock can never push past the viewport width.

Note the shell right-aligns this dock row, so the shortened bar sits toward the
right with space to its left. That is the shell's own `justify-content`; the
plugin does not force it.

### Header: the background-job chip

With a job running the header grew from 42px to **74px**, because
"2 background jobs running" (168px of a 168px row) wrapped to its own line —
and, in the user's words, looked bad.

Two fixes:

| | Before | After |
|---|---|---|
| job chip | `2 background jobs running` | `2 jobs` |
| mode chip | `Standard mode` shown | hidden (composer already shows it) |
| header | 74px | **60px** |

Still two rows. To reach one row the chips must fit 168px, and they measure
`92 + 6 + 80 = 178` — **10px over**. Closing that gap means a trade the user
should choose: drop the chevrons (~28px), shorten "subagents" to "subs"
(~20px), or shrink the type to 11px (~10px, extremely marginal).

**Trap found here:** two elements match `[class*="headerActions"]` — the
sidebar's (empty, `w=0`) and the conversation's. `querySelector` returns the
sidebar's, so targeting it silently did nothing and the first two attempts to
fix this appeared to have no effect at all.

**Second trap, in my own code:** the loop originally skipped any headerActions
whose text did not contain "background". After the first rewrite the text reads
"2 jobs" — so the guard then skipped the element forever, and the mode label
stopped being hidden on later passes. It now processes every candidate; the
sidebar's empty one is a harmless no-op.

### Resolved: header on one row, title restored

```
Mac mi...   [glyph]2  (o)1  [app] ...  []
Chat  Trajectory
```

| | before | after |
|---|---|---|
| header height | 74px, wrapping | 30px, one row |
| session title | gone (width 0) | `Mac mi...` |
| subagents chip | `2 subagents` (92px) | glyph + `2` (39px) |
| jobs chip | `2 background jobs running` (168px) | spinner + `1` (52px) |
| headerActions | 168px | 97px |

**Why the title vanished.** `crumbs` (the title) and `headerActions` (the chips)
are SIBLINGS inside `titleCluster`, sharing its 168px. The chips took all of it
and `crumbs` has `overflow: hidden`, so it collapsed to `w=0` and disappeared
with no error at all. A `min-width: 76px` floor on `crumbs` fixes it, and
compacting the chips is what makes that floor affordable — the two changes are
coupled, not independent.

**Why the glyph.** The subagents chip has no icon of its own, only a chevron.
Once the word was gone it was indistinguishable from the jobs chip beside it,
which does have a spinner. `U+2B21` is prepended in the same `textContent`
write, which keeps it React-safe: no DOM insertion to fight with re-renders.

### The job chip's wording is NOT stable

The chip reads **"2 background jobs"** in one state and **"2 background jobs
running"** in another. The first regex anchored on `running$`, so it silently
did nothing in the shorter state.

It LOOKED fixed because the verification happened to catch the longer wording.
The user's screenshot showed `[glyph]2` correctly rewritten beside an untouched
`2 background jobs` — half-applied, which is the tell.

Now: `/^(\d+)\s+background\s+jobs?\b/i` — count plus noun, any suffix.

**Lesson for this plugin:** assert against every wording the shell actually
produces, not the one that happened to be on screen when the selector was
written. Prefer suffix-tolerant patterns for text that a UI may vary.

A simple guard for next time — test the pattern directly:

```
node -e 'const RE = /^(\d+)\s+background\s+jobs?\b/i;
  for (const c of ["2 background jobs","2 background jobs running",
                   "1 background job","1 background job running"])
    console.log(c, "->", RE.exec(c))'
```

## Auto-collapse the sidebar when a session is picked

On a phone the open sidebar covers nearly the whole screen, so you had to tap
the toggle again to get back to the conversation you had just chosen.

Session rows carry **`role="treeitem"`** — an ARIA role, so the hook survives
the hashed class names changing. (The row is `jJkEga_sessionRow` today; matching
that would break on the next build.)

Guarded three ways:

1. mobile only (`max-width: 640px`)
2. only while the sidebar is OPEN — the open state is that same element
   **without** the `_collapsed` class
3. only for a click that lands on a `treeitem` **inside** the sidebar, so the
   rail's own controls (New Session, Plugins, Settings) are untouched

The collapse fires after a 120ms delay, so the app processes the selection
first.

Verified at 375x667: `w=0 collapsed` -> open `w=280` -> click a treeitem ->
`w=0 collapsed`.

## The open sidebar is an overlay drawer

Opening the sidebar widened the frame's grid track 56px -> 280px, so the chat
column collapsed 319px -> ~95px and the transcript was crushed to a few
characters per line (`ow / ns / the / ses`).

On a phone it should float OVER the conversation instead:

```css
[class*="_frame"]:not(:has([class*="_collapsed"])) {
  grid-template-columns: 0px minmax(0, 1fr) 0px !important;   /* chat full width */
}
[class*="_frame"]:not(:has([class*="_collapsed"]))::after {
  content: ""; position: fixed; inset: 0;                     /* scrim */
  background: rgba(0, 0, 0, 0.42); z-index: 65;
}
[class*="sidebarCol"]:not(:has([class*="_collapsed"])) {
  position: fixed; left: 0; top: 0; bottom: 0;
  width: 280px; max-width: 86vw; z-index: 70;
}
```

`:not(:has([class*="_collapsed"]))` is the OPEN state — the collapsed rail is
that same element WITH `_collapsed`.

### "Tap outside to close" falls out of the scrim for free

A pseudo-element reports its **originating element** as the event target, so a
tap on the scrim arrives at the click handler as `ev.target === frame`. No
extra backdrop element is needed:

```js
if (frame !== null && ev.target === frame) { collapse(); return; }
```

Verified at 375x667: sidebar `width=281px position=fixed z-index=70 left=0`,
selector matches, chat column stays **375px** behind it.

### Trap: never put a backtick inside these template literals

The CSS lives in a JS template literal. Writing a backtick in a CSS *comment*
terminates the string and the whole module fails to parse:

```
SyntaxError: Unexpected token ':'
```

Cost a round. Same class of bug as a stray backtick in the generator script.
`node --check` catches it immediately — run it before every commit.

### CRITICAL: never measure a value your own CSS sets

The first drawer implementation locked the user out — a black screen with
nothing to tap, recoverable only by resizing the window out of mobile view.

```js
// BROKEN
var open = col.getBoundingClientRect().width > 100;   // self-fulfilling
```

The class it added forced `width: 280px !important` on the sidebar, so the next
measurement **always** reported "open". The class could never be removed, the
scrim stuck on, and there was no sidebar under it.

**Rule: read the app's own state, never your own effect on it.**

```js
// CORRECT — _collapsed is the shell's class; our CSS never touches it
var open = col.querySelector('[class*="_collapsed"]') === null;
```

### One class for the scrim AND the drawer — they must not be able to diverge

An earlier version drove them from two separate `:has()` selectors. When those
disagreed the result was a scrim with no drawer: the same lockout. Both rules now
hang off a single `html.dsh-agentbox-drawer` class, so the failure mode is "no
drawer", never "stuck scrim".

### Tap-outside collapses synchronously

The scrim is the frame's `::after`, so a tap on it arrives as
`ev.target === frame` and needs no backdrop element. There is no session to
select, so it collapses immediately — every millisecond of delay is another
chance to be left stuck.

### Safety matrix (verified)

| viewport | state | drawer | scrim | sidebar |
|---|---|---|---|---|
| 1440px | at load | false | false | 280px |
| 1440px | toggled | false | false | 56px |
| 375px | at load | false | false | 0px |
| 375px | opened | true | true | 281px |
| 375px | after session tap | false | false | 0px |
| 375px | after scrim tap | false | false | 0px |

## What breaks on a DSH update, and how you find out

Every rule here reaches into DSH's private CSS Module names or into
dsh-usage-chart's DOM. **None of that is a public contract.** A broken selector
does not throw — the fix just stops applying and the layout quietly goes back to
desktop-shaped. That silent failure is the real risk, not a crash.

### `tools/health.mjs` — run this after any DSH update

```sh
cd ~/agent/tools && node health.mjs      # exit 0 = healthy, 1 = degraded
```

It loads the running service headlessly, tests all 25 load-bearing assumptions
against the live DOM, and names what broke and why it mattered.

### Dependency risk, by tier

| Tier | Depends on | Survives an update? |
|---|---|---|
| **1** | `role="treeitem"` — an ARIA role | Yes, unless the session list is rebuilt |
| **2** | CSS Module **local names**: `_frame`, `sidebarCol`, `_collapsed`, `centerCol`, `titleRow`, `headerActions`, `crumbs`, `_markdown_`, `_header_`, `scrollBody`, `_list_` | Usually — the hash changes every build but the local name only changes if someone renames the component |
| **3** | `dsh-usage-chart`'s `.duc-*` classes | Unhashed, so stable — until that author restructures |
| **4** | **UI text**: `"Input"`, `"Output"`, `"Cache"`, `"Cost"`, `"Balance"`, `"N background jobs"`, `"Standard mode"` | **Fragile, and this tier has already broken once** |

Tier 4 is the weak point. Those spans carry no class, so the only handle is the
wording — and the job chip has already been observed as both `"2 background
jobs"` and `"2 background jobs running"`. A current regex is suffixed-tolerant,
but a reworded label defeats any pattern.

### Hash-dependent selectors: eliminated

The audit found five rules each naming a rail button, three of which embedded a
**content hash** (`_7514NG_iconButton`, `_7514NG_searchButton`, `Dws9Sa_rail`).
Those break on every rebuild. All five were replaced by a single
`overflow: hidden` on the collapsed rail; the fixed-position toggle still paints
because no ancestor creates a containing block. Verified by hit-testing every
rail button at its own centre: only the toggle is reachable.

**The plugin now depends on no hardcoded hash.**

### A real bug the health check caught on its first useful run

`_scrollable_` is **not** the transcript scroller. Measured: the conversation
scrolls in `ST7X_W_scrollBody` (scrollHeight 15026 inside a 591px box). The
composer-spacing rule had been applying padding to *nothing* since it was
written. Now targets `scrollBody`; verified `paddingBottom: 24px` lands.

### The assertions must test VISIBLE text

`textContent` includes `display:none` subtrees. Asserting on it reports hidden
elements as present and produces false PASSES — worse than no check. This same
mistake has cost three rounds in this project. `health.mjs` filters by rendered
box, and a vacuity guard fails loudly if the header is unreadable rather than
letting the wording assertions pass on an empty string.

## The send button disappearing behind the iOS keyboard

Symptom: starting to type hides the composer's toolbar row, so the send button
is unreachable.

Cause: **iOS Safari does not shrink the LAYOUT viewport for the keyboard.** It
shrinks only the VISUAL viewport and overlays the keyboard (plus its accessory
bar) on top. The composer sits at the bottom of the layout:

```
yhfFVG_card     position: relative   y=722  h=98    (viewport 874)
  yhfFVG_row    static               y=778  h=42
    yhfFVG_primary  (send button)    y=778  h=34
```

so its toolbar row lands underneath the keyboard. **Chromium shrinks the layout
viewport instead**, which is why every earlier headless test passed — this bug
was unreproducible in the harness and had to be read off a screenshot.

Fix: publish `visualViewport.height` to `--dsh-agentbox-vvh` and size the frame
to it, so the composer's bottom sits at the visual bottom, just above the
keyboard.

```js
var vv = window.visualViewport
vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply)
```

Two deliberate safety choices:

- **height only, never transform.** A transform would make the frame a
  containing block for fixed descendants and break both the drawer and the
  floating rail toggle.
- **`clamp(240px, var(...), 100dvh)` plus `min-height: 240px`.** Setting the
  variable by hand to 40px shrank the entire app to 40px in testing. Verified:
  `40px -> 240`, `0px -> 240`, `99999px -> 874`.

  **What the floor does NOT cover:** a NON-length value makes the declaration
  invalid at computed-value time, so `height` falls back to `auto` and the frame
  becomes content-sized — measured **318px**, which is *above* the floor, so the
  floor does not catch it. That is a layout change, not a lockout, and the JS
  only ever writes `"<n>px"` behind a range guard. Noted so the limit is not
  mistaken for full protection.

**Not verifiable in this harness.** Chromium cannot reproduce the iOS layout
viewport behaviour, so this is correct by construction and by the standard
pattern, not by measurement. It needs confirmation on the device.

## The transcript showing through the composer while typing

Symptom: as you type, the gap under the textarea grows and the conversation's
text appears behind it.

Cause: the composer's **outer containers are transparent; only its card is
opaque**.

```
yhfFVG_root    bg=rgba(0,0,0,0)      h=128
yhfFVG_card    bg=rgb(255,255,255)   h=98    <- only this is opaque
yhfFVG_row     bg=rgba(0,0,0,0)      h=42
composerStack  bg=rgba(0,0,0,0)
```

So a ~30px band around the card shows whatever is behind it — and the band grows
with each line typed.

Fix: give `composerStack` the shell's own background.

```css
[class*="composerStack"] {
  background-color: var(--dsw-alias-bg-base, Canvas) !important;
}
```

**The fallback matters.** `#ffffff` would flash a bright band in dark mode,
which is how this box is used. `--dsw-alias-bg-base` is defined below
`documentElement` (so an early probe of `documentElement` reported it unset and
nearly led to a hardcoded white). Verified it resolves to `rgb(255,255,255)`
light and `rgb(21,21,23)` dark, and `composerStack` now equals the shell's own
background in both.

## "Add workspace" does nothing from a phone

Not a plugin bug — and not fixable by the plugin. It is the shell's own
boot-time backend choice:

> `native` requires a loopback-only bind, a non-SSH launch, and a servable
> display session; anything ambiguous resolves to `browse`, which works
> everywhere. An all-interfaces bind admits remote browsers no OS chooser can
> reach.

Our bind **is** loopback-only and there **is** a display session, so the shell
resolves to `native` — the macOS folder chooser. That dialog opens **on the Mac
mini's screen**, where a phone user cannot see or reach it.

**This is the same root cause as the Open-in-Finder button** doing nothing
remotely: the shell assumes a loopback bind means a local user, and
`tailscale serve` quietly invalidates that assumption by proxying through
loopback.

The only lever is the bind. `--host 0.0.0.0` would resolve to `browse` (the
in-page picker, which works remotely) at the cost of listening on every
interface — a security posture change, not a styling one, and deliberately not
made here.

## Enter inserts a newline on mobile (`enterNewline`)

The composer sends on a bare Enter; only **Shift+Enter** inserts a line break.
Verified in the live composer: typing `alpha`, Shift+Enter, `beta` yields
`alpha\nbeta`, while a bare Enter clears the composer. On a phone keyboard
Shift+Enter is two taps and may not set the modifier, so a five-line message
arrives as **five messages**.

`enterNewline` (default on) swaps it: Enter breaks the line, the send button
sends — the mobile convention.

### Only one mechanism works

Tried and rejected, in the live composer:

| Approach | Result |
|---|---|
| Re-dispatch a synthetic Shift+Enter keydown | **ignored** — Lexical rejects untrusted events; text came out `alphabetagamma` |
| `execCommand('insertLineBreak')` | no effect |
| `execCommand('insertText', false, '\n')` | no effect |
| `execCommand('insertHTML', false, '<br>')` | inserted a break but bypasses the editor |
| **`beforeinput` with `inputType: 'insertLineBreak'`** | **works** |

### Two traps, both mine

**1. Listener placement.** Registered on `document`, it lost the race to the
shell's own send handler: `stopImmediatePropagation` only stops listeners
registered *after* ours on the *same* node. Moved to **`window`**, whose capture
phase runs first (`window → document → target`).

**2. Definition order — the subtle one.** The handler was defined *inside*
`apply()` but used *above* its assignment:

```js
window.addEventListener("keydown", onComposerEnter, true);   // line 545
var onComposerEnter = function (ev) { ... };                 // line 635
```

`var` hoists the *binding*, not the assignment, so `addEventListener` received
`undefined` — which is **legal and silently does nothing**. No error, no
listener, no clue. The handler now lives at module scope, before `apply`.

Verified: the handler fires on every keydown and the composer holds
`"ZQ7-one\nZQ7-two\nZQ7-three"` as three lines. The newline's survival into the
delivered message could **not** be verified here — the send landed in the queue
(button read "Queue message") because the agent was busy, so it never reached
the transcript to inspect.

## REVERTED: sizing the frame to visualViewport.height

I added this to stop the composer sitting behind the iOS keyboard, and it made
things **worse**. On the device it moved the composer to the TOP of the screen
with a blank area beneath it, and the textarea became unreachable — the user had
to open the Trajectory panel and tap the composer there to get it back.

Why it failed: iOS scrolls the page when an input is focused. Shrinking the
frame AND letting iOS scroll meant the composer ended up above the visible area
instead of at its bottom. The fix assumed the frame's height was the only
variable, but the scroll offset is equally involved — and compensating with a
transform was ruled out because it would make the frame a containing block and
break the drawer and the floating rail toggle.

**The lesson is the process, not the CSS.** This was pushed while explicitly
unverifiable in the harness ("correct by construction"), and it broke a working
state. An unverifiable fix to a live interface is a guess, and a guess should not
be shipped on the strength of a plausible-sounding mechanism.

Reverted in full: the frame-height rule, the visualViewport listeners, the
CSS variable and its cleanup. The frame is back to the shell's own sizing.

The original problem remains — iOS overlays the keyboard on the visual viewport
and the composer's toolbar sits beneath it. That belongs upstream; the shell
should handle the iOS keyboard, and every local workaround tries to reconstruct
a viewport the platform will not expose reliably.

## The dock vanishing (only the context meter left)

Symptom: the usage dock disappears entirely, leaving only the shell's context
meter. Confirmed from a device screenshot with the **keyboard down**, so it is
not the keyboard/viewport issue.

Cause: **two of my own rules fought over `.duc-root`, and both outcomes can hide
content with no visual cue.**

```css
/* mobile block */
.duc-root { flex-shrink: 0; max-width: 100%; overflow-x: hidden !important; }
/* dock block   */
.duc-root { flex-wrap: nowrap; overflow-x: auto !important; scrollbar-width: none; }
```

Two `!important` declarations for `overflow-x` on the same selector: the later
one wins, but `hidden` clips and `auto` with the scrollbar suppressed clips just
as invisibly. If the text renders wider than the box — and **macOS WebKit and
iOS Safari do not measure text identically** — the contents are clipped to
nothing and the dock looks like it vanished, while the shell's meter beside it
renders fine.

That also explains why it never reproduced here: Playwright runs macOS WebKit,
where the text happens to fit.

Fix: one rule, and it cannot clip.

```css
.duc-root { flex-wrap: wrap !important; overflow: visible !important; }
```

Wrapping can only ever show **more**, never less. Verified at 402/360/320px:
`clipped=false` at every width, one line at 402 and 360, and it wraps to two
lines at 320 rather than disappearing.

**Rule for this plugin: never `overflow: hidden` on a container whose content
you did not create.** The width belongs to another plugin's text; clipping it is
a way to delete content you cannot measure.

## The suite that catches "I fixed one thing and broke three"

`tools/regress.mjs` checks **behaviour**, not assumptions:

```sh
node tools/regress.mjs          # live service on 19388
node tools/regress.mjs 19390    # a throwaway instance
```

It exits non-zero if anything regressed. Run it after **every** edit, before
reporting anything as fixed.

`health.mjs` asks "do my selectors still exist". That question passed while the
composer was unreachable, while the dock was invisible, and while the chat
column was 0px wide. **Assumptions are not behaviour.**

It runs in **WebKit**, because Chromium hid a real bug for several rounds —
macOS Chromium and iOS Safari do not measure text identically.

### It caught this immediately

The open sidebar made the chat **0px wide** — the conversation vanished into a
blank area, the opposite of "hovers over the chat":

```
CLOSED : tracks "0px 402px 0px"   sidebar w=0     chat w=402
OPEN   : tracks "0px 402px 0px"   sidebar w=281   chat w=0
```

Cause: the frame's grid has **five** children and the shell sets
`grid-column: auto` on every one. Auto-placement happened to produce the right
answer while the sidebar was in flow:

```
i=0  _sidebarCol    track 1
i=1  _centerCol     track 2   <- the chat
i=2  _rightbarCol   track 3
```

The open drawer is `position: fixed`, which removes `sidebarCol` from the flow —
so **everything slid up one track**: the chat landed in the 0px rail track and
the *right* sidebar took the full width. Measured: `centerCol` 0px,
`rightbarCol` 402px.

Fix: pin the two columns, inside `@media (max-width: 640px)` so desktop is
untouched.

```css
[class*="centerCol"]   { grid-column: 2 !important; }
[class*="rightbarCol"] { grid-column: 3 !important; }
```

**Lesson: never rely on auto-placement in a container whose flow you alter.**
Taking one item out of flow silently re-assigns every auto-placed sibling.

## Stable selectors: what is proven, and what is not

`docs/DSH-STABLE-SELECTORS.md` records the shell's `data-*` API. The plugin now
prefers it, keeping the hashed class as a fallback alternative in each selector.

**Verified by element identity** (stable selector resolves to exactly the same
element as the hashed one):

| Stable hook | Replaces |
|---|---|
| `[data-sidebar-collapsed]` | `[class*="_frame"]` |
| `[data-sidebar-collapsed] > *:has([data-slot="sidebar"])` | `[class*="sidebarCol"]` |
| `[data-sidebar-collapsed] > *:has([data-slot="main"])` | `[class*="centerCol"]` |
| `[data-rightbar-col]` | `[class*="rightbarCol"]` |
| `[data-conversation-scroll]` | `[class*="scrollBody"]` |
| `[data-composer-seat]` | `[class*="composerStack"]` |

**Verified by behaviour**: with those hashed alternatives removed, the suite
passes **14/16** — so the hooks genuinely carry their rules, they are not
cosmetic. The two failures are both in the drawer rule
(`html.dsh-agentbox-drawer ...`), where the strip script mis-targeted an
alternative; that rule still needs its fallback until it is cleaned up.

### Two traps, both mine, both caught by the suite

**1. Cascading replacement.** Rewriting selector substrings one rule at a time
let later rules re-match text earlier ones had just inserted, nesting `:has()`
into nonsense. Fixed by doing it in **one regex pass** so no replacement is ever
reprocessed.

**2. The state attribute is not the styling target.** `data-sidebar-collapsed`
lives on the **frame**, but the rail-collapse rule styles the **column**. Adding
`[data-sidebar-collapsed="true"]` to that rule made the rule match the frame and
set `width: 0; min-width: 0; max-width: 0` **on the whole app** — the frame
collapsed to 0px wide, the grid tracks went `0px 0px 0px`, and the chat vanished.
The suite caught it instantly (`tracks "0px 0px 0px"`, `content 0px of 402px`).
The column must be addressed structurally:
`[data-sidebar-collapsed] > *:has([data-slot="sidebar"])`.

**A state attribute marks WHERE the state lives. It says nothing about what you
intend to style.**
