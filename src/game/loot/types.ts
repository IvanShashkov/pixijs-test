/** Outcome of opening one chest / container. Pre-rolled when a round ends. */
export type DropResult =
  { kind: 'bonus'; points: number } | { kind: 'nothing' } | { kind: 'activity'; id: string };
