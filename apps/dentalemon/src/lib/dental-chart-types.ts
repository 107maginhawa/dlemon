/**
 * Shared dental-chart domain types.
 *
 * `ToothState` is consumed by both the `workspace` chart components and the
 * `patients` folder/thumbnail components. It lives in `lib/` (a neutral lower
 * layer) so neither feature has to import a type out of the other's component
 * file — which previously formed a `patients` ↔ `workspace` import edge.
 */

export type ToothState =
  | 'healthy'
  | 'caries'
  | 'fractured'
  | 'filled'
  | 'crown'
  | 'missing'
  | 'implant'
  | 'extracted'
  | 'watchlist';
