/** Monthly verified hours as a line, with reported-but-unverified hours as a quieter dashed line. Hand-built SVG on tokens. */
export function ValueChart({ points, format }: { points: { label: string; value: number; pending?: number }[]; format: (n: number) => string }) {
  const width = 720;
  const height = 180;
  const left = 44;
  const right = 16;
  const top = 20;
  const bottom = 28;
  const plotH = height - top - bottom;
  const plotW = width - left - right;
  const rawMax = Math.max(1, ...points.map((p) => p.value + (p.pending ?? 0)));
  const target = rawMax / 3;
  const power = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= target) ?? 10 * power;
  const max = step * 3;
  const ticks = [0, step, step * 2, step * 3];
  const x = (i: number) => left + 20 + (points.length === 1 ? plotW / 2 : (i * (plotW - 40)) / (points.length - 1));
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const line = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const hasPending = points.some((p) => p.pending);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Verified hours saved per month">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} y1={y(t)} x2={width - right} y2={y(t)} className="stroke-border" strokeWidth={1} />
          <text x={left - 8} y={y(t) + 4} textAnchor="end" className="fill-text-faint text-tiny">
            {format(t)}
          </text>
        </g>
      ))}
      {hasPending && <path d={line(points.map((p) => p.value + (p.pending ?? 0)))} fill="none" className="stroke-border-strong" strokeWidth={1.5} strokeDasharray="4 4" />}
      <path d={line(points.map((p) => p.value))} fill="none" className="stroke-brand" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.value)} r={3.5} className="fill-brand" />
          <text x={x(i)} y={height - 8} textAnchor="middle" className="fill-text-muted text-tiny">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
