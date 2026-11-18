import { defineConfig } from 'vitest/config';

/**
 * Runner configuration for `ng test` (`@angular/build:unit-test` + Vitest).
 *
 * Why the timeout override: the suite runs the spec files in parallel, and the
 * heavy component specs (`booking-detail-dialog`, `full-calendar`,
 * `packs-list`, dialogs de locations/providers/packs) routinely exceed
 * Vitest's 5 s default while the machine is also serving or building. Those
 * failures were pure timeouts, not assertions — the same files pass in
 * isolation and the whole suite went green once the budget was raised, so a
 * 5 s budget reports load as if it were a regression. 15 s keeps a real hang
 * failing fast while removing that noise.
 */
export default defineConfig({
  test: {
    testTimeout: 15000,
  },
});
