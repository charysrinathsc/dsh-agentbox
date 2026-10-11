window.__ModuleLoader__.load({ id: "dsh-agentbox", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";

/**
 * dsh-agentbox — client half.
 *
 * Phone-layout fixes for this box, in version control rather than in a patched
 * node_modules file that the next plugin update deletes.
 *
 * MODULE FORMAT — this is NOT an ES module. The client loader evaluates bundles
 * wrapped in window.__ModuleLoader__.load({ id, factory }) with CommonJS
 * exports. Shipping `export function apply` fails with "failed to import" and
 * the plugin never mounts. The server half (../lib/index.js) must ALSO exist,
 * because a bundle entry is mounted BY NAME and a bare name resolves to the
 * package root — without it the entry never activates and the client half never
 * runs either.
 *
 * VERIFIED with Playwright at 375x667 (iPhone SE) against a real conversation,
 * on a live instance with nothing injected — see ../tools/verify-live.mjs:
 *
 *     rail                   56px -> 0     (content column 319px -> 375px)
 *     usage dock (collapsed)  9 rows -> 2  (189px -> 41px)
 *     usage dock (terse)           -> 1    (41px -> 21px, nothing clipped)
 *     header collision       painted over the title -> wraps
 *
 * SELECTOR NOTE — two class-naming conventions coexist and need OPPOSITE
 * substring patterns:
 *
 *     _3WPZCG_toggle       hash FIRST, name LAST  -> match "_toggle"
 *     _markdown_1wejo_28   name first, hash last  -> match "_markdown_"
 *
 * Writing "_toggle_" matches NOTHING, because nothing follows the name.
 *
 * WHY THE RAIL FIX IS SHAPED THE WAY IT IS
 *   The shell's frame is a GRID: grid-template-columns: 56px 319px 0px.
 *   A grid TRACK cannot be collapsed by resizing the child inside it. Setting
 *   position:fixed on the rail child removed it from the grid, the tracks were
 *   reassigned, and the content column fell into the 56px track — 319px became
 *   56px and clipped off the left edge. The track itself must change.
 *
 *   It is also CONDITIONAL: the open sidebar is that same element at 280px, so
 *   collapsing the track unconditionally would make the sidebar unreachable on
 *   a phone. :has([class*="_collapsed"]) separates the states.
 *
 * WHY THE MEDIA QUERY
 *   The shell ships one media query in its entire stylesheet
 *   (prefers-reduced-motion) and no responsive breakpoints. Everything here is
 *   scoped to <=640px, so desktop is untouched.
 */

var CSS_ID = "dsh-agentbox/css";

/** Verified phone-layout fixes: rail reclamation, header, text, dock chrome. */
function mobileCss() {
  return `
@media (max-width: 640px) {

  /* ---- 1. Reclaim the rail: 56px of a 375px screen is 15% ---------------- */
  [data-sidebar-collapsed="true"], [class*="_frame"]:has([class*="_collapsed"]) {
    grid-template-columns: 0px minmax(0, 1fr) 0px !important;
  }

  /* Auto-placement must not shift when the drawer opens.
     The frame has FIVE children (sidebarCol, centerCol, rightbarCol plus two
     absolutely-positioned layers) and the shell gives every one of them
     grid-column: auto. Normally auto-placement assigns sidebarCol to track 1,
     centerCol to track 2, rightbarCol to track 3.
     But the open drawer is position:fixed, which removes sidebarCol from the
     flow — so everything slides up one track: the CHAT lands in the 0px rail
     track and the RIGHT sidebar takes the full width. Measured before this fix:
     centerCol 0px, rightbarCol 402px — the conversation vanished into a blank
     area, which is the opposite of "the sidebar hovers over the chat".
     Pinning the two columns makes the drawer overlay the chat instead of
     deleting it. mobileCss is entirely inside @media (max-width: 640px), so
     desktop layout is untouched. */
  [data-sidebar-collapsed] > *:has([data-slot="main"]), [class*="centerCol"] { grid-column: 2 !important; }
  [data-rightbar-col], [class*="rightbarCol"] { grid-column: 3 !important; }
  [data-sidebar-collapsed] > *:has([data-slot="sidebar"]), [class*="sidebarCol"]:has([class*="_collapsed"]) {
    width: 0 !important;
    min-width: 0 !important;
    max-width: 0 !important;
    /* hidden, not visible. The rail's buttons would otherwise spill out of a
       zero-width box and paint over the content. Clipping them here replaces
       FIVE selectors that each named a button individually — three of which
       embedded a build hash (_7514NG_iconButton, _7514NG_searchButton,
       Dws9Sa_rail) and would break on any DSH rebuild.
       The _toggle is position:fixed, and a fixed element escapes an ancestor's
       overflow unless that ancestor creates a containing block (transform /
       filter / contain), which none here does — verified: toggle still paints
       at 6,6 and nothing else does. */
    overflow: hidden !important;
    border-right: none !important;
  }

  /* ---- 2. Keep the way back: the only control that opens the session
     sidebar lives in the rail we just collapsed. Without this the user is
     stranded, so it floats. */
  [data-sidebar-collapsed] > *:has([data-slot="sidebar"]) [class*="_toggle"], [class*="sidebarCol"]:has([class*="_collapsed"]) [class*="_toggle"] {
    position: fixed !important;
    top: 6px !important;
    left: 6px !important;
    z-index: 60;
    opacity: 0.5;
    border-radius: 8px;
  }
  [data-sidebar-collapsed] > *:has([data-slot="sidebar"]) [class*="_toggle"]:active, [class*="sidebarCol"]:has([class*="_collapsed"]) [class*="_toggle"]:active {
    opacity: 1;
  }

  /* ---- 3. Drop the rest of the collapsed rail. Scoped to COLLAPSED, because
     when the sidebar is open these same elements are its full-width rows. */

  /* ---- 4. Header de-collision. The title row is 271px but its child
     headerActions renders 289px starting 10px inside it, so it runs 28px past
     its parent and paints OVER the title. */
  [class*="titleRow"] {
    flex-wrap: wrap !important;
    row-gap: 4px !important;
    padding-left: 40px !important;
    min-width: 0 !important;
  }
  [class*="headerActions"] {
    flex-wrap: wrap !important;
    min-width: 0 !important;
    max-width: 100% !important;
    row-gap: 4px !important;
    column-gap: 6px !important;
  }
  /* The chips inside default to filling the row (measured: the job chip was
     168px wide for ~55px of content), which forces each onto its own line and
     the header to 60px. Sizing them to content lets them share a row, so
     "2 subagents" and "2 jobs" sit together and the header returns to 42px. */
  [class*="headerActions"] > * {
    flex: 0 1 auto !important;
    min-width: 0 !important;
  }
  /* Once sized to content they still come to 178px in a 168px row — 10px over.
     Trimming the type by ~1.5px buys that back without dropping any words, so
     the header stays one row AND keeps showing both counts. */
  [class*="headerActions"],
  [class*="headerActions"] * {
    font-size: 12px !important;
  }
  /* The session title and the status chips are SIBLINGS inside titleCluster
     and share its 168px. Without a floor the chips win and the title collapses
     to width 0 (it also has overflow:hidden, so it vanishes silently) — which
     is exactly what happened once the chips grew. The crumbs get a floor; the
     chips give way. */
  [class*="titleCluster"] {
    min-width: 0 !important;
    flex-shrink: 1 !important;
  }
  [class*="crumbs"] {
    min-width: 76px !important;
    flex: 1 1 auto !important;
  }
  [class*="_header_"] {
    flex-wrap: wrap !important;
    row-gap: 6px !important;
    column-gap: 8px !important;
    min-width: 0 !important;
  }

  /* ---- 5. Text containment: long unbroken tokens pushed the transcript past
     its box. A flex chain that will not shrink needs min-width:0 on the
     ancestors as well as a hard wrap on the text. */
  [class*="_markdown_"],
  [class*="_bubble_"] {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }
  [class*="_markdown_"] pre,
  [class*="_markdown_"] code {
    white-space: pre-wrap !important;
    overflow-wrap: anywhere !important;
  }
  /* _scrollable_ is NOT the transcript scroller. Measured: the conversation
     scrolls in ST7X_W_scrollBody (scrollHeight 15026 in a 591px box), so the
     old selector applied padding to nothing and the composer-overlap fix never
     took effect. Both are listed now — the shell mixes two naming conventions
     (hash_first_Local vs _local_hash_line) and this element uses the former,
     where a trailing underscore would match nothing. */
  [class*="_scrollable_"],
  [data-conversation-scroll], [class*="scrollBody"],
  [class*="_list_"] {
    min-width: 0 !important;
  }

  /* ---- 6. The composer floats over the transcript; reserve room so the last
     message is never hidden underneath it. */
  [data-conversation-scroll], [class*="scrollBody"] {
    padding-bottom: 24px !important;
  }

  /* ---- 7. Reclaim horizontal space from desktop padding. */
  [class*="_prompt_"],
  [class*="_promptLine_"] {
    padding-left: 10px !important;
    padding-right: 10px !important;
  }
  [class*="_toolbar_"] {
    column-gap: 4px !important;
  }

  /* ---- 8. Usage dock chrome. The word "Usage" costs 33px of a 336px row that
     the shell's own counters also occupy, so the icon alone identifies the
     control. flex-shrink:0 stops the dock being squeezed into truncation by
     its siblings. */
  .duc-toggle-label { display: none !important; }
  .duc-toggle { padding-left: 2px !important; padding-right: 2px !important; }
  [class*="_dock"] { column-gap: 4px !important; }

  /* Balance and the context-pressure bar are clutter in a phone status bar.
     The balance is still in the dashboard when you tap the indicator. */
  .duc-balance { display: none !important; }
  .duc-pressure { display: none !important; }

  /* ---- 8b. Stop iOS zooming the page when you tap the composer ----------
     iOS Safari zooms the whole page whenever an input, textarea or
     contenteditable with font-size BELOW 16px receives focus. Verified: the
     composer editor renders at 14px, so every tap into it zoomed the page
     and you had to pinch back out.

     16px is the documented floor. This is not a styling preference — anything
     smaller re-triggers the zoom, so the size cannot be "tidied" down. */
  input,
  textarea,
  [contenteditable="true"] {
    font-size: 16px !important;
  }

  /* ---- 8b-2. Stop the transcript showing through the composer ------------
     The composer's outer containers are transparent; only its card is opaque.
     Measured: yhfFVG_root is 128px tall while its card is 98px, and
     composerStack is transparent too — so a ~30px band around the card lets the
     transcript behind it paint through. The band grows with every line typed,
     which is why "background text flows in" while typing.

     The fallback is the CSS system colour Canvas, NOT #ffffff: this box is used
     in dark mode, where a hardcoded white would flash a bright band. Verified
     the token resolves to rgb(21,21,23) in dark and rgb(255,255,255) in light,
     with Canvas matching both. */
  [data-composer-seat], [class*="composerStack"] {
    background-color: var(--dsw-alias-bg-base, Canvas) !important;
  }


  /* ---- 9. The OPEN sidebar becomes an overlay drawer ---------------------
     The frame is a grid, so opening the sidebar widened its track 56px ->
     280px and the chat column collapsed 319px -> ~95px. The transcript was
     crushed to a few characters per line ("ow / ns / the / ses").

     STATE IS MEASURED, NOT GUESSED. An earlier version drove the scrim and the
     drawer from two separate :has() selectors. When those two disagreed the
     result was a scrim with no sidebar: a black screen with nothing to tap and
     the user locked out. Both rules now hang off ONE class that JavaScript sets
     from the sidebar's measured width, so they cannot diverge.

     The class is on <html> (dsh-agentbox-drawer), set only when the sidebar is
     wider than the 56px rail AND the viewport is mobile. */
  html.dsh-agentbox-drawer [data-sidebar-collapsed], html.dsh-agentbox-drawer [class*="_frame"] {
    grid-template-columns: 0px minmax(0, 1fr) 0px !important;
  }
  html.dsh-agentbox-drawer [data-sidebar-collapsed], html.dsh-agentbox-drawer [class*="_frame"]::after {
    content: "";
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.42);
    z-index: 65;
  }
  html.dsh-agentbox-drawer [class*="sidebarCol"], html.dsh-agentbox-drawer [data-sidebar-collapsed] > *:has([data-slot="sidebar"]) {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    bottom: 0 !important;
    width: 280px !important;
    max-width: 86vw !important;
    height: 100dvh !important;
    z-index: 70 !important;
    overflow-y: auto !important;
    box-shadow: 2px 0 18px rgba(0, 0, 0, 0.35);
  }
}
`
}

/**
 * Durability fix for the usage indicator's wrapping.
 *
 * Upstream dsh-usage-chart sets `flex-wrap: wrap` on its .duc-root status row.
 * That row holds ~7 metrics; measured at 375px it became 9 rows / 189px tall —
 * a fifth of the screen for one line of text. Kept to a single scrolling row
 * it is 2 rows / 41px.
 *
 * Replaces an earlier fix applied directly to the plugin's built client.js,
 * which any "dsh plugin update" would have wiped. Worth a PR upstream: a
 * single-line status bar should not wrap at narrow widths.
 */
function usageDockCss() {
  return `
/* WRAP, do not clip.
   This used to be nowrap + overflow hidden/auto with the scrollbar suppressed.
   Both of those can hide content with no visual cue: if the text renders wider
   than the box — which differs between macOS WebKit and iOS Safari — the dock
   is clipped to empty and looks like it vanished, while the shell's context
   meter beside it still shows. That matches the reported symptom exactly.
   Wrapping can only ever show MORE, never less. With the noisy metrics hidden
   on mobile the dock holds ~2 short items, so it still sits on one line in
   practice; wrapping is the fallback if it ever cannot. */
.duc-root {
  flex-wrap: wrap !important;
  overflow: visible !important;
}
`
}

/* ---------------------------------------------------------------------------
 * Terse dock — the JS half.
 *
 * The dock's metric spans carry NO class (verified in the live DOM):
 *
 *     button.duc-toggle  "Usage"         w=74
 *     span (no class)    "Input 190M"    w=31
 *     span (no class)    "·Output 618K"  w=47
 *     span (no class)    "·Cache 99%"    w=43
 *     span (no class)    "·Cost $1.219"  w=37
 *     span (no class)    "·flash"        w=35
 *
 * With no classes, CSS cannot tell Input from Cost, so this identifies them by
 * TEXT. That is more robust than nth-child, which silently rebinds whenever an
 * optional metric is absent.
 *
 * Measured effect: "Usage ▸ Input 192M ·Output 630K · ·Cache 99% · ·Cost
 * $1.232 · ·flash" (41px, clipped) becomes "▸ in:192M ·out:630K" (21px, one
 * row, nothing clipped).
 *
 * The shell's own "93 turns / 559 steps / 258 tok" counters are hidden here
 * too: they share the 336px row with the dock and are the reason it truncated.
 * They remain visible on desktop.
 * ------------------------------------------------------------------------- */

function applyTerseDock() {
  if (!window.matchMedia("(max-width: 640px)").matches) return;

  // Value rewrites, in match order. The labels are words the glyph already
  // conveys, and words were costing more width than the numbers.
  //   Input 199M  ->  ↓199M       (tokens into the model)
  //   Output 660K ->  ↑660K       (tokens out of the model)
  //   Cache 99%   ->  ⚡99%        (cache-hit ratio)
  //   Cost $1.26  ->  $1.26
  var REWRITES = [
    [/^Input\s+/, "\u2193"],
    [/^Output\s+/, "\u2191"],
    [/^Cache\s+/, "\u26a1"],
    [/^Cost\s+/, ""]
  ];

  // Dropped on a phone: the balance (still in the dashboard on tap) and the
  // bare model name, which the composer already shows.
  var DROP = [/^\s*Balance\s/, /^\s*[a-z][a-z0-9.\-]*\s*$/i];

  var dock = document.querySelector(".duc-root");
  if (dock !== null) {
    var spans = dock.querySelectorAll("span");
    for (var i = 0; i < spans.length; i++) {
      var el = spans[i];
      if (el.classList.contains("duc-sep") || el.classList.contains("duc-pressure")) continue;

      var raw = el.textContent || "";
      var lead = raw.charAt(0) === "·" ? "·" : "";
      var body = lead ? raw.slice(1) : raw;

      if (el.classList.contains("duc-toggle-label")) { el.style.display = "none"; continue; }

      if (DROP.some(function (re) { return re.test(body); })) {
        el.style.display = "none";
        continue;
      }

      var text = body;
      for (var r = 0; r < REWRITES.length; r++) {
        if (REWRITES[r][0].test(text)) { text = text.replace(REWRITES[r][0], REWRITES[r][1]); break; }
      }
      // Only touch the DOM when it actually changes, so this stays cheap.
      var next = lead + text;
      if (raw !== next) el.textContent = next;
      el.style.display = "";
    }
  }

  // Hide the shell's turn/step/token counter GROUP wholesale.
  //
  // Hiding its individual text labels is NOT enough, which was the first
  // attempt and looked broken. Measured in the live DOM:
  //
  //     OpZ85W_root    x=-6  w=0   <- the group collapses to zero width
  //       OpZ85W_label w=0  "94 turns 574 steps..."  <- and its text spills
  //       OpZ85W_label w=0  "197M tok·Cache hit 9..."
  //
  // A zero-width box with visible overflow renders as a truncated "1..." and a
  // stray icon at the left edge, overlapping the dock. Removing the group is
  // the only way to reclaim the space cleanly.
  //
  // The context meter (y0jqnG_root, "32%") is ALSO a *_root, so it cannot be
  // matched by class alone — the text tells them apart.
  var row = document.querySelector('[class*="_dock"]');
  if (row === null) return;
  var groups = row.querySelectorAll('[class*="_root"]');
  for (var j = 0; j < groups.length; j++) {
    var g = groups[j];
    if (g.classList.contains("duc-root")) continue;
    if (/\d\s*(turns?|steps?|tok)/i.test(g.textContent || "")) g.style.display = "none";
  }

  // Header chips — two things make the header double in height when a job runs.
  //
  // TRAP: TWO elements match [class*="headerActions"] — the sidebar's (empty,
  // width 0) and the conversation's. querySelector returns the FIRST, which is
  // the sidebar's, so targeting it silently does nothing. This must iterate and
  // pick the one that actually holds the job text.
  //
  // Measured: "Standard mode" (~90px) plus "2 background jobs running" (168px)
  // do not fit the 168px row, so the header grew 42px -> 74px.
  //
  // Match on an element's OWN text nodes, not textContent: an ancestor's
  // textContent contains the same string, and rewriting that would delete the
  // icon children sitting beside it.
  var sets = document.querySelectorAll('[class*="headerActions"]');
  // The wording is NOT stable: the chip reads "2 background jobs" in one state
  // and "2 background jobs running" in another. An earlier version anchored on
  // `running$` and so silently did nothing in the shorter state — it LOOKED
  // fixed because the measurement happened to catch the longer one. Match the
  // count and the noun, then accept any suffix.
  var JOB_COUNT = /^(\d+)\s+background\s+jobs?\b/i;
  var MODE_LABEL = /^(standard|plan)\s+mode$/i;

  for (var s = 0; s < sets.length; s++) {
    var acts = sets[s];
    // No text guard here, deliberately. An earlier version skipped any
    // headerActions that did not contain "background" — but after the first
    // rewrite the text reads "2 jobs", so the guard then skipped the element
    // forever and the mode label stopped being hidden on later passes. The
    // sidebar's headerActions is empty, so processing every one is a no-op
    // there and correct everywhere else.
    if (acts.children.length === 0) continue;

    var els = acts.querySelectorAll("span, div");
    for (var m = 0; m < els.length; m++) {
      var c = els[m];
      var own = "";
      for (var n = 0; n < c.childNodes.length; n++) {
        if (c.childNodes[n].nodeType === 3) own += c.childNodes[n].textContent;
      }
      own = own.trim();
      if (own === "") continue;

      var g = JOB_COUNT.exec(own);
      if (g !== null) { c.textContent = g[1]; continue; }

      // Subagents: the chip has NO icon of its own (only a chevron), so the
      // glyph is added here to keep it distinguishable from the jobs chip
      // beside it, which carries a spinner. "2 subagents" was ~70px of text;
      // "\u2b21 2" is ~22px, and that reclaimed width is what lets the session
      // title render again.
      var sub = /^(\d+)\s+subagents$/i.exec(own);
      if (sub !== null) { c.textContent = "\u2b21\u2009" + sub[1]; continue; }

      // A mode is a setting, not status — the composer already shows it, and it
      // costs ~90px of the 168px row. Matched on the element's FULL text rather
      // than its own text nodes, because the chip wraps "Standard" and "mode"
      // in separate nodes and the own-text check misses it.
      //
      // Only the OUTERMOST match is hidden: if the parent also reads as a bare
      // mode label then this node is inside the chip, not the chip itself, and
      // hiding it would leave an orphaned half behind.
      var full = (c.textContent || "").trim();
      if (MODE_LABEL.test(full)) {
        var parentText = c.parentElement ? (c.parentElement.textContent || "").trim() : "";
        if (!MODE_LABEL.test(parentText)) c.style.display = "none";
      }
    }
  }
}

function buildCss(config) {
  var parts = [];
  if (config.mobileCss !== false) parts.push(mobileCss());
  if (config.usageDockCompact !== false) parts.push(usageDockCss());
  return parts.join("\n");
}

/** Idempotent injection using the platform's own convention, so an HMR reload
 *  replaces rather than stacks stylesheets. */
function injectCss(css) {
  var previous = document.querySelector('style[data-plugin-css="' + CSS_ID + '"]');
  if (previous !== null) previous.remove();

  var style = document.createElement("style");
  style.setAttribute("data-plugin-css", CSS_ID);
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

// ---- Enter inserts a newline on mobile ---------------------------------
//
// The composer sends on a bare Enter; only Shift+Enter inserts a line break
// (verified: typing "alpha", Shift+Enter, "beta" gives "alpha\nbeta", while a
// bare Enter clears the composer). On a phone keyboard Shift+Enter is two
// taps and may not even set the modifier, so multi-line input is effectively
// unavailable — a five-line message arrives as five messages.
//
// Swapping it matches the mobile convention: Enter breaks the line, the send
// button sends.
//
// Only `beforeinput` with inputType insertLineBreak works. Tested and
// REJECTED: re-dispatching a synthetic Shift+Enter keydown (Lexical ignores
// untrusted events — the text came out "alphabetagamma"), insertLineBreak via
// execCommand, insertText, and insertHTML.
var onComposerEnter = function (ev) {
  if (ev.key !== "Enter" || !ev.isTrusted) return;          // !isTrusted => our own, let through
  if (ev.shiftKey || ev.metaKey || ev.ctrlKey || ev.altKey) return;  // modifiers keep stock behaviour
  if (!window.matchMedia("(max-width: 640px)").matches) return;
  var ed = ev.target && ev.target.closest ? ev.target.closest('[contenteditable="true"]') : null;
  if (ed === null) return;

  ev.preventDefault();
  ev.stopImmediatePropagation();
  ed.dispatchEvent(new InputEvent("beforeinput", {
    inputType: "insertLineBreak", bubbles: true, cancelable: true,
  }));
};

function apply(ctx, config) {
  var resolved = {
    mobileCss: true,
    usageDockCompact: true,
    usageDockTerse: true,
    enterNewline: true,
  };
  if (config) {
    if (config.mobileCss !== undefined) resolved.mobileCss = config.mobileCss;
    if (config.usageDockCompact !== undefined) resolved.usageDockCompact = config.usageDockCompact;
    if (config.usageDockTerse !== undefined) resolved.usageDockTerse = config.usageDockTerse;
    if (config.enterNewline !== undefined) resolved.enterNewline = config.enterNewline;
  }

  var css = buildCss(resolved).trim();
  if (css !== "") {
    var style = injectCss(css);
    // Effects dispose on unload/HMR, so a reload never leaves a stale
    // stylesheet behind fighting the next version of itself.
    ctx.effect(function () { return function () { style.remove(); }; }, "dsh-agentbox: stylesheet cleanup");
  }

  if (resolved.enterNewline !== false) {
    // window, not document: capture runs window -> document -> target, and
    // stopImmediatePropagation only stops listeners registered AFTER ours on the
    // SAME node. On document we lost the race to the shell's own send handler.
    window.addEventListener("keydown", onComposerEnter, true);
    ctx.effect(function () {
      return function () { window.removeEventListener("keydown", onComposerEnter, true); };
    }, "dsh-agentbox: enter inserts newline");
  }

  if (resolved.usageDockTerse === false) return;

  applyTerseDock();

  // The dock re-renders on every token update, so re-apply on mutation — but
  // coalesce to one pass per frame, because the transcript mutates constantly
  // while streaming and this must not become a hot path.
  var pending = false;
  var schedule = function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { applyTerseDock(); syncDrawer(); } catch (e) { /* never break the app over a label */ }
    });
  };

  // ---- Drawer state, MEASURED -------------------------------------------
  // Driving the scrim and the drawer from separate :has() guesses let them
  // disagree, which produced a scrim with no sidebar: a black screen and no
  // way out. One class, set from a real measurement, cannot drift.
  //
  // The rail is 56px; anything wider means the sidebar is genuinely open. The
  // class is removed on any other condition, so the failure mode is "no
  // drawer", never "stuck scrim".
  var syncDrawer = function () {
    var col = document.querySelector('[data-sidebar-collapsed] > *:has([data-slot="sidebar"]), [class*="sidebarCol"]');
    var root = document.documentElement;
    if (col === null) { root.classList.remove("dsh-agentbox-drawer"); return; }
    var mobile = window.matchMedia("(max-width: 640px)").matches;

    // Read the APP's state, never our own effect.
    //
    // The first version measured getBoundingClientRect().width > 100 here. That
    // is self-fulfilling and it locked the user out: our own rule forces
    // `width: 280px !important` while the class is set, so the measurement
    // always reported "open", the class was never removed, and the scrim stuck
    // on with no sidebar and nothing to tap.
    //
    // _collapsed is the shell's own class and our CSS never touches it, so it
    // cannot be influenced by what we do.
    // Prefer the shell's OWN published state: data-sidebar-collapsed lives on
    // the frame and is set by the shell. The hashed-class search is only a
    // fallback for builds that lack it.
    var frameEl = document.querySelector('[data-sidebar-collapsed], [class*="_frame"]');
    var attr = frameEl === null ? null : frameEl.getAttribute("data-sidebar-collapsed");
    var open = (attr === null || attr === undefined)
      ? col.querySelector('[class*="_collapsed"]') === null
      : attr !== "true";

    if (mobile && open) {
      root.classList.add("dsh-agentbox-drawer");

      // FAILSAFE against a future DSH renaming the sidebar classes.
      //
      // If the class is set but the sidebar is still narrow, our selectors no
      // longer match this build — which means the scrim would render with no
      // drawer under it. That is the lockout, so drop the class and stay
      // disabled rather than showing a black screen.
      //
      // This is NOT the self-fulfilling bug from before: that one kept the
      // class BECAUSE the width was large, which was circular. This checks the
      // opposite direction and can only ever remove it. If the CSS applies,
      // the width becomes 280px and the guard passes.
      if (col.getBoundingClientRect().width < 100) root.classList.remove("dsh-agentbox-drawer");
    } else {
      root.classList.remove("dsh-agentbox-drawer");
    }
  };
  syncDrawer();

  var observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  ctx.effect(function () { return function () { observer.disconnect(); }; }, "dsh-agentbox: terse dock observer");



  var onResize = function () { syncDrawer(); };
  window.addEventListener("resize", onResize);
  ctx.effect(function () {
    return function () {
      window.removeEventListener("resize", onResize);
      document.documentElement.classList.remove("dsh-agentbox-drawer");
    };
  }, "dsh-agentbox: drawer cleanup");

  // ---- Auto-collapse the sidebar when a session is picked -----------------
  //
  // On a phone the open sidebar covers nearly the whole screen, and you had to
  // tap the toggle again to get back to the conversation you just chose.
  //
  // Session rows carry role="treeitem" — an ARIA role, so this survives the
  // hashed class names changing (the row is jJkEga_sessionRow today). The
  // alternative, matching a class, would break on the next build.
  //
  // Guarded three ways: mobile only, only while the sidebar is OPEN (the open
  // state is the same element but without _collapsed), and only for a click
  // that actually lands on a treeitem inside the sidebar — so the rail's own
  // buttons (New Session, Plugins, Settings) are untouched.
  var onSidebarClick = function (ev) {
    if (!window.matchMedia("(max-width: 640px)").matches) return;

    var col = document.querySelector('[data-sidebar-collapsed] > *:has([data-slot="sidebar"]), [class*="sidebarCol"]');
    if (col === null) return;
    if (col.querySelector('[class*="_collapsed"]') !== null) return; // already closed

    var collapse = function () {
      // Let the app process the selection first, then collapse.
      setTimeout(function () {
        var toggle = col.querySelector('[class*="_toggle"]');
        if (toggle !== null && typeof toggle.click === "function") toggle.click();
      }, 120);
    };

    // Tap outside: the drawer's scrim is the frame's ::after, and a
    // pseudo-element reports its ORIGINATING element as the event target — so
    // a tap on the dimmed area arrives here as ev.target === frame.
    var frame = document.querySelector('[class*="_frame"]');
    if (frame !== null && ev.target === frame) {
      // No session to select, so no reason to wait — collapse synchronously.
      // Every millisecond of delay here is another chance to be left stuck.
      var t = col.querySelector('[class*="_toggle"]');
      if (t !== null && typeof t.click === "function") t.click();
      return;
    }

    // Tap on a session row.
    var row = ev.target && ev.target.closest ? ev.target.closest('[role="treeitem"]') : null;
    if (row === null || !col.contains(row)) return;
    collapse();
  };

  document.addEventListener("click", onSidebarClick, true);
  ctx.effect(function () {
    return function () { document.removeEventListener("click", onSidebarClick, true); };
  }, "dsh-agentbox: auto-collapse sidebar");
}

module.exports = { name: "dsh-agentbox", apply: apply };
return module.exports; } });
