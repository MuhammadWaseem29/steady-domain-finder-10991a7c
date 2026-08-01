import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
