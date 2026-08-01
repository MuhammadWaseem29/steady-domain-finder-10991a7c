import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


type Point = { label: string; value: number };

const axisProps = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  boxShadow: "0 12px 30px -12px color-mix(in oklab, var(--color-foreground) 30%, transparent)",
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--color-popover-foreground)",
};

export function DiscoveryAreaChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={52} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--color-border)" }} />
        <Area
          type="monotone"
          dataKey="value"
          name="New subdomains"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#gNew)"
          isAnimationActive
          animationDuration={1100}
          animationEasing="ease-out"
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ScanBarChart({
  data,
}: {
  data: { label: string; scans: number; errors: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={52} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} />
        <Bar dataKey="scans" name="Scans" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} animationDuration={900} animationEasing="ease-out" />
        <Bar dataKey="errors" name="Errors" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} animationDuration={900} animationBegin={150} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" {...axisProps} />
        <YAxis type="category" dataKey="label" width={150} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-accent)" }} />
        <Bar dataKey="value" name="New subdomains" fill="var(--color-chart-1)" radius={4} animationDuration={900} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ShareDonut({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const palette = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={62}
          outerRadius={98}
          paddingAngle={3}
          stroke="var(--color-background)"
          strokeWidth={2}
          animationDuration={1000}
          animationEasing="ease-out"
        >
          {data.map((d, i) => (
            <Cell key={d.label} fill={d.color || palette[i % palette.length]} />
          ))}
        </Pie>
        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CumulativeLineChart({ data }: { data: Point[] }) {
  let running = 0;
  const cum = data.map((d) => {
    running += d.value;
    return { label: d.label, value: running };
  });
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={cum} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} minTickGap={24} />
        <YAxis {...axisProps} width={48} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="value"
          name="Cumulative new"
          stroke="var(--color-chart-2)"
          strokeWidth={2.5}
          dot={false}
          animationDuration={1100}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DiscoveryHeatmap({ cells }: { cells: { dow: number; hour: number; c: number }[] }) {
  const map = new Map<string, number>();
  let max = 0;
  for (const cell of cells) {
    const v = Number(cell.c);
    map.set(`${cell.dow}-${cell.hour}`, v);
    if (v > max) max = v;
  }
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="mb-1 flex gap-[3px] pl-9">
          {Array.from({ length: 24 }).map((_, h) => (
            <span
              key={h}
              className="w-[18px] text-center text-[9px] text-muted-foreground"
            >
              {h % 3 === 0 ? h : ""}
            </span>
          ))}
        </div>
        {DAYS.map((day, d) => (
          <div key={day} className="mb-[3px] flex items-center gap-[3px]">
            <span className="w-9 text-[10px] text-muted-foreground">{day}</span>
            {Array.from({ length: 24 }).map((_, h) => {
              const v = map.get(`${d}-${h}`) ?? 0;
              const ratio = max ? v / max : 0;
              return (
                <span
                  key={h}
                  title={`${day} ${h}:00 — ${v.toLocaleString()} new`}
                  className="h-[18px] w-[18px] rounded-[4px] border border-border/60 transition-transform hover:scale-125"
                  style={{
                    background: v
                      ? `color-mix(in oklab, var(--color-chart-1) ${Math.round(12 + ratio * 88)}%, transparent)`
                      : "var(--color-muted)",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
