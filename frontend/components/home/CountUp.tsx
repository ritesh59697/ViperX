/**
 * Renders `value` as-is.
 *
 * This used to count 0 → `value` when the number scrolled into view, driven by
 * an IntersectionObserver plus a requestAnimationFrame easing loop. The landing
 * page deliberately does not animate on scroll any more, so the count-up is
 * gone and the stats read their real figure at first paint.
 *
 * Kept as a component rather than inlined because the stats grid tints its
 * suffix (`+`, `%`) in the accent colour, so the suffix stays a sibling element
 * in the page rather than being concatenated in here.
 */
export function CountUp({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return <span className={className}>{value}</span>;
}
