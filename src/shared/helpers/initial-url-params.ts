/**
 * The query string attached before the `#` (Google's OAuth `state`/`code`, or `?logger=`),
 * captured once at module load — before Angular's router runs at all.
 *
 * `HashLocationStrategy` resolves the relative URL it passes to `history.pushState`/
 * `replaceState` (e.g. `#/setup/login`) against the document's base URL, i.e. `index.html`'s
 * `<base href>` — not against the current `location.href`. That base has no query string, so
 * the very first internal redirect the router performs (which happens before any component's
 * `ngOnInit` gets a chance to run) silently drops whatever sat before the `#` from the real
 * address bar. Anything that needs a pre-hash query parameter must read it from here, once,
 * rather than re-parsing `window.location.href` later.
 */
const search = window.location.href.split('?')[1];
export const initialUrlParams = new URLSearchParams(search);
