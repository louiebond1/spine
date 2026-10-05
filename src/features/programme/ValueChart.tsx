/** Line chart of a monthly total (10). Hand-built SVG using the design tokens only. */
export function ValueChart({ points, format }: { points: { label: string; value: number }[]; format: (n: number) => string }) {
  const width = 1100;
  const height = 170;
  const left = 56;
  const right = 40;
  const top = 24;
  const bottom = 34;
  const plotH = height - top - bottom;
  const plotW = width - left - right;

  const rawMax = Math.max(1, ...points.map((p) => p.value));
  // Smallest "nice" step (1, 2 or 5 times a power of ten) so three steps cover the data: 42 -> 0, 20, 40, 60.
  const target = rawMax / 3;
  const power = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= target) ?? 10 * power;
  const max = step * 3;
  const ticks = [0, step, step * 2, step * 3];

  const x = (i: number) => left + 36 + (points.length === 1 ? plotW / 2 : (i * (plotW - 72)) / (points.length - 1));
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const lastIndex = points.length - 1;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Value over time">
      {ticks.map((t) => (
        <text key={t} x={left - 16} y={y(t) + 5} textAnchor="end" className="fill-text-muted text-label">
          {format(t)}
        </text>
      ))}
      <line x1={left} y1={top - 8} x2={left} y2={top + plotH} className="stroke-border" strokeWidth={1} />
      <line x1={left} y1={top + plotH} x2={width - 8} y2={top + plotH} className="stroke-border" strokeWidth={1} />
      <line x1={left} y1={y(max)} x2={width - 8} y2={y(max)} className="stroke-border" strokeWidth={1} />
      <path d={path} fill="none" className="stroke-brand" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.value)} r={5} className="fill-brand" />
          <text x={x(i)} y={height - 6} textAnchor="middle" className="fill-text-muted text-label">
            {p.label}
          </text>
          {i === lastIndex && (
            <text x={x(i)} y={y(p.value) - 14} textAnchor="middle" className="fill-brand text-label font-semibold">
              {format(p.value)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
