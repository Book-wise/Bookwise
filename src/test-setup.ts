/**
 * jsdom does not implement `Element.scrollTo`, but the app calls it from
 * FullCalendar and some PrimeNG overlays. Without a stub the call throws
 * asynchronously, Vitest reports an unhandled error and the whole suite fails
 * even when every test passed. Keep this setup file loaded from
 * `vitest.config.ts` so `npm test` and the CI `tests` job stay honest.
 */
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollTo !== 'function') {
  Object.defineProperty(Element.prototype, 'scrollTo', {
    value: () => undefined,
    writable: true,
    configurable: true,
  });
}
