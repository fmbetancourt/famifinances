// TEMPORARY throwaway file to prove CI blocks a broken change (FND-01 T025).
// Deliberate type error → typecheck gate fails → PR must be unmergeable.
export const brokenOnPurpose: number = 'this is not a number';
