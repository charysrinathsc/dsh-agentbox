/**
 * dsh-agentbox — server half.
 *
 * THERE IS NOTHING TO DO HERE, AND THAT IS THE POINT.
 *
 * This plugin only injects a stylesheet, and stylesheets are a browser concern,
 * so all the real work is in ./client.js. But the bundle patch mounts an entry
 * BY NAME:
 *
 *     - insert:
 *         - id: dsh-agentbox
 *           name: dsh-agentbox      <-- resolved through package.json "exports"
 *
 * and a bare package name resolves to the package ROOT ("."). With no "." export
 * and no lib/index.js, that resolution fails and the entry never activates:
 *
 *     dsh: warning: 1 entry did not activate
 *     dsh-agentbox (dsh-agentbox): failed to import
 *
 * The plugin then does not load AT ALL — the client half included — even though
 * the client half is perfectly valid. That one missing file cost two restarts
 * and made a working stylesheet look broken.
 *
 * So: keep this file. It is not dead code, it is the thing the bundle patch
 * resolves to. Same shape as any other profile bundle.
 */

export const name = 'dsh-agentbox'

/**
 * No host-side behaviour. The toggles in cordis.patch.yml are read by the
 * client half's apply(ctx, config); nothing needs to happen on the server.
 */
export function apply() {}
