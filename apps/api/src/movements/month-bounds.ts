/** Half-open UTC month bounds [from, to) for a 'YYYY-MM' period. */
export function monthBounds(period: string): { from: Date; to: Date } {
  const [year, month] = period.split('-').map(Number); // month is 1..12
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1)); // month=12 → next January (year rolls over)
  return { from, to };
}
