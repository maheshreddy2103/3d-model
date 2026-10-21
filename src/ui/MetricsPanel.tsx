import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { engine } from '../sim/engineInstance';
import { computeMetrics, formatDuration } from '../sim/metrics';
import { useUI } from '../state/uiStore';

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function MetricsPanel() {
  const show = useUI((s) => s.show.metrics);
  useUI((s) => s.tick);
  if (!show) return null;
  const m = computeMetrics(engine);
  const data = engine.history.map((h) => ({ min: Math.round(h.t / 60), throughput: Math.round(h.throughput), wip: h.wip }));

  const tiles: [string, string, string?][] = [
    ['In production', String(m.inProduction)],
    ['Completed', String(m.completed), `${m.shipped} shipped`],
    ['Awaiting / in test', `${m.awaitingInspection} / ${m.inTest}`],
    ['Rework · scrapped', `${m.inRework} · ${m.scrapped}`, `${m.reworkedTotal} repaired`],
    ['First-pass yield', pct(m.firstPassYield), `overall ${pct(m.overallYield)}`],
    ['Avg cycle time', formatDuration(m.avgLeadTime), 'kit release → pallet'],
    ['Throughput', `${m.throughput.toFixed(0)}/h`, 'last 10 min'],
    ['Utilisation', pct(m.utilization), 'avg of 19 stations'],
  ];

  return (
    <section className="panel metrics" aria-label="Production metrics">
      <div className="kpis">
        {tiles.map(([label, value, sub]) => (
          <div className="kpi" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            {sub && <em>{sub}</em>}
          </div>
        ))}
      </div>
      <div className="chart">
        <div className="chart-title">Throughput (motors/h) and WIP, simulated minutes</div>
        <ResponsiveContainer width="100%" height={86}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <XAxis dataKey="min" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ fontSize: 11 }} labelFormatter={(v) => `min ${v}`} />
            <Area type="monotone" dataKey="throughput" stroke="#1f6fb2" fill="#1f6fb2" fillOpacity={0.18} strokeWidth={1.5} isAnimationActive={false} />
            <Area type="monotone" dataKey="wip" stroke="#f2a51b" fill="#f2a51b" fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
