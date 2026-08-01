import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Clock, Layers, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/site/chrome";
import { CountUp } from "@/components/site/motion";
import { LiveRelative } from "@/components/site/live-time";
import { cancelScanJob, listScanQueue } from "@/lib/chaos.functions";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Scan queue — pending & running Chaos scans" },
      {
        name: "description",
        content:
          "Live view of every queued, running and finished subdomain scan job, plus how many root domains are due in the current 2-hour cycle.",
      },
      { property: "og:title", content: "Scan queue — pending & running Chaos scans" },
      {
        property: "og:description",
        content: "Every queued, running and completed subdomain scan job in one live view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QueuePage,
});

const ACTIVE = new Set(["queued", "fetching", "processing"]);

function statusTone(status: string) {
  if (status === "success") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (status === "error") return "bg-destructive/10 text-destructive";
  if (status === "queued") return "bg-muted text-muted-foreground";
  return "bg-primary/10 text-primary";
}

function QueuePage() {
  const load = useServerFn(listScanQueue);
  const cancel = useServerFn(cancelScanJob);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["scan-queue"],
    queryFn: () => load({ data: undefined as never }),
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => cancel({ data: { jobId } }),
    onSuccess: () => {
      toast.success("Job cancelled");
      void qc.invalidateQueries({ queryKey: ["scan-queue"] });
    },
  });

  const jobs = data?.jobs ?? [];
  const active = jobs.filter((j) => ACTIVE.has(j.status));
  const finished = jobs.filter((j) => !ACTIVE.has(j.status));
  const due = data?.dueDomains ?? 0;
  const total = data?.totalDomains ?? 0;
  const swept = Math.max(total - due, 0);
  const pct = total > 0 ? Math.round((swept / total) * 100) : 0;

  return (
    <Shell>
      <div className="space-y-8 py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="chip-mono mb-3 inline-flex items-center gap-2">
            <span className="live-dot" /> SCAN QUEUE
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Scan queue</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every manual scan and every oversized program deferred by the rolling sweep lands here.
            Jobs resume across worker ticks, so no program is too large to finish.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={<Loader2 className="h-4 w-4" />} label="ACTIVE JOBS" value={active.length} hint="queued · fetching · saving" />
          <Card icon={<Activity className="h-4 w-4" />} label="SCANS IN FLIGHT" value={data?.runningScans ?? 0} hint="rolling sweep workers" />
          <Card icon={<Layers className="h-4 w-4" />} label="DOMAINS DUE" value={due} hint={`of ${total.toLocaleString()} root domains`} />
          <Card icon={<Clock className="h-4 w-4" />} label="CYCLE" value={data?.cycleMinutes ?? 120} suffix=" min" hint="full re-scan interval" />
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="font-semibold">Current cycle progress</h2>
              <p className="text-sm text-muted-foreground">
                {swept.toLocaleString()} of {total.toLocaleString()} root domains scanned in this 2-hour window
              </p>
            </div>
            <span className="font-mono text-2xl font-bold">{pct}%</span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        <Section title="Pending & running" subtitle="updates every 5s">
          {isLoading ? (
            <Row muted>Loading queue…</Row>
          ) : active.length === 0 ? (
            <Row muted>Nothing queued — the sweep is keeping up.</Row>
          ) : (
            <AnimatePresence initial={false}>
              {active.map((j) => (
                <motion.div
                  key={j.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  <Link
                    to="/domain/$domain"
                    params={{ domain: j.domain }}
                    className="font-mono text-sm hover:underline"
                  >
                    {j.domain}
                  </Link>
                  <span className={`chip-mono ${statusTone(j.status)}`}>{j.status}</span>
                  <span className="text-xs text-muted-foreground">
                    {j.total > 0
                      ? `${j.processed.toLocaleString()} / ${j.total.toLocaleString()} hosts`
                      : "waiting for host list"}
                  </span>
                  {j.total > 0 && (
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, Math.round((j.processed / j.total) * 100))}%` }}
                      />
                    </div>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    +{j.newCount.toLocaleString()} new · <LiveRelative iso={j.createdAt} />
                  </span>
                  <button
                    type="button"
                    onClick={() => cancelMutation.mutate(j.id)}
                    className="rounded-md border border-border p-1 text-muted-foreground transition hover:text-destructive"
                    aria-label={`Cancel scan for ${j.domain}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </Section>

        <Section title="Recently finished" subtitle="last 80 jobs">
          {finished.length === 0 ? (
            <Row muted>No completed jobs yet.</Row>
          ) : (
            finished.map((j) => (
              <div
                key={j.id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <Link
                  to="/domain/$domain"
                  params={{ domain: j.domain }}
                  className="font-mono text-sm hover:underline"
                >
                  {j.domain}
                </Link>
                <span className={`chip-mono ${statusTone(j.status)}`}>{j.status}</span>
                <span className="text-xs text-muted-foreground">
                  {j.total.toLocaleString()} hosts · +{j.newCount.toLocaleString()} new
                </span>
                {j.error && (
                  <span className="truncate text-xs text-destructive" title={j.error}>
                    {j.error}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {j.finishedAt ? <LiveRelative iso={j.finishedAt} /> : null}
                </span>
              </div>
            ))
          )}
        </Section>
      </div>
    </Shell>
  );
}

function Card({
  icon,
  label,
  value,
  hint,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  suffix?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md bg-muted p-1.5 text-muted-foreground">{icon}</span>
        <span className="chip-mono">{label}</span>
      </div>
      <div className="font-mono text-3xl font-bold">
        <CountUp value={value} />
        {suffix}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </motion.div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <span className="chip-mono">{subtitle}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div className={`px-4 py-6 text-sm ${muted ? "text-muted-foreground" : ""}`}>{children}</div>
  );
}
