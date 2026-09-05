import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Mail, Trash2, Send, Pause, Play } from "lucide-react";

import { SiteShell, Reveal, Stat } from "@/components/site/chrome";
import { useSession } from "@/lib/use-session";
import { platformsQuery, timeAgo } from "@/lib/chaos-data";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  type Frequency,
  createAlertSubscription,
  deleteAlertSubscription,
  listAlertSubscriptions,
  sendAlertNow,
  sendTestAlertEmail,
  setAlertSubscriptionActive,
} from "@/lib/alerts.functions";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Email alerts for new subdomains — Chaos" },
      {
        name: "description",
        content:
          "Get emailed the moment new subdomains are discovered. Choose instant, continuous, hourly or daily digests, scoped to programs, root domains or keywords.",
      },
      { property: "og:title", content: "Email alerts for new subdomains — Chaos" },
      {
        property: "og:description",
        content:
          "Subscribe to instant, hourly or daily emails whenever new subdomains show up in your scope.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertsPage,
});

type Scope = "all" | "platforms" | "domains";

function AlertsPage() {
  const { user, loading } = useSession();
  const qc = useQueryClient();

  const list = useServerFn(listAlertSubscriptions);
  const create = useServerFn(createAlertSubscription);
  const toggle = useServerFn(setAlertSubscriptionActive);
  const remove = useServerFn(deleteAlertSubscription);
  const sendNow = useServerFn(sendAlertNow);
  const sendTest = useServerFn(sendTestAlertEmail);

  const [email, setEmail] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [scope, setScope] = useState<Scope>("all");
  const [platformIds, setPlatformIds] = useState<string[]>([]);
  const [domainText, setDomainText] = useState("");
  const [keywordText, setKeywordText] = useState("");
  const [notifyLive, setNotifyLive] = useState(false);
  const [liveCodes, setLiveCodes] = useState<number[]>([]);

  const toggleCode = (code: number) =>
    setLiveCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code].sort((a, b) => a - b),
    );

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  const platforms = useQuery(platformsQuery);
  const subs = useQuery({
    queryKey: ["alert-subscriptions", user?.id],
    queryFn: () => list(),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          email: email.trim(),
          frequency,
          scope,
          platform_ids: platformIds,
          domains: domainText
            .split(/[\s,]+/)
            .map((d) => d.trim())
            .filter(Boolean),
          keywords: keywordText
            .split(/[\s,]+/)
            .map((k) => k.trim())
            .filter(Boolean),
          notify_live: notifyLive,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert-subscriptions"] });
      setDomainText("");
      setKeywordText("");
      toast.success("Alert created — you'll be emailed when new hosts land");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-subscriptions"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert-subscriptions"] });
      toast.success("Alert deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => sendNow({ data: { id } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["alert-subscriptions"] });
      if (res.sent) toast.success(`Sent ${res.hosts.toLocaleString()} new hosts`);
      else if (res.reason === "nothing_new") toast.info("Nothing new to send right now");
      else if (res.reason === "email_domain_not_configured")
        toast.error("Sender domain isn't set up yet — alerts are queued but not delivered");
      else toast.error(res.reason ?? "Not sent");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: (address: string) => sendTest({ data: { email: address } }),
    onSuccess: (res) => {
      if (res.sent) toast.success("Test email sent — check the inbox (and spam)");
      else toast.error(res.reason ?? "Test email was not sent");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = subs.data ?? [];
  const activeCount = rows.filter((r) => r.is_active).length;
  const totalSent = rows.reduce((a, r) => a + Number(r.sent_count ?? 0), 0);


  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <Reveal>
          <p className="label-mono flex items-center gap-2 text-muted-foreground">
            <Bell className="size-3.5" /> Email alerts
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Get emailed when new subdomains appear
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pick a cadence and a scope. Every alert only contains hosts discovered since the last
            one we sent you — never a repeat.
          </p>
        </Reveal>

        {!loading && !user ? (
          <Reveal className="mt-8 rounded-lg border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Email alerts are for signed-in accounts.
            </p>
            <Link
              to="/auth"
              search={{ next: "/alerts" }}
              className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign in to subscribe
            </Link>
          </Reveal>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Stat label="Active alerts" value={activeCount} index={0} />
              <Stat label="Total alerts" value={rows.length} index={1} />
              <Stat label="Hosts emailed" value={totalSent} index={2} />
            </div>

            <Reveal className="mt-6 rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Test email delivery</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Sends a sample digest with dummy hosts so you can confirm alerts land in your inbox.
              </p>
              <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const address = (testEmail || user?.email || "").trim();
                  if (!address) {
                    toast.error("Enter an email address");
                    return;
                  }
                  testMutation.mutate(address);
                }}
              >
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder={user?.email ?? "you@example.com"}
                  className="min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={testMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-60"
                >
                  <Send className="size-4" />
                  {testMutation.isPending ? "Sending…" : "Send test email"}
                </button>
              </form>
            </Reveal>



            <Reveal className="mt-8 rounded-lg border border-border bg-card p-5">
              <h2 className="text-lg font-bold tracking-tight">New alert</h2>

              <form
                className="mt-4 grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="label-mono text-muted-foreground">Send to</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="block">
                    <span className="label-mono text-muted-foreground">Frequency</span>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as Frequency)}
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f} value={f}>
                          {FREQUENCY_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <span className="label-mono text-muted-foreground">Scope</span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {(
                      [
                        ["all", "Everything"],
                        ["platforms", "Specific programs"],
                        ["domains", "Specific root domains"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setScope(value)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          scope === value
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {scope === "platforms" && (
                  <div className="flex flex-wrap gap-2">
                    {(platforms.data ?? []).map((p) => {
                      const on = platformIds.includes(p.platform_id);
                      return (
                        <button
                          key={p.platform_id}
                          type="button"
                          onClick={() =>
                            setPlatformIds((prev) =>
                              on
                                ? prev.filter((x) => x !== p.platform_id)
                                : [...prev, p.platform_id],
                            )
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                            on ? "border-foreground bg-accent" : "border-border hover:bg-accent"
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}

                  </div>
                )}

                {scope === "domains" && (
                  <label className="block">
                    <span className="label-mono text-muted-foreground">
                      Root domains (comma or newline separated)
                    </span>
                    <textarea
                      value={domainText}
                      onChange={(e) => setDomainText(e.target.value)}
                      rows={3}
                      placeholder="lovable.app, taobao.com"
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="label-mono text-muted-foreground">
                    Keyword filter (optional) — only hosts containing any of these
                  </span>
                  <input
                    value={keywordText}
                    onChange={(e) => setKeywordText(e.target.value)}
                    placeholder="api, vpn, admin, staging"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>

                <label className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={notifyLive}
                    onChange={(e) => setNotifyLive(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-sm">
                    Also notify me when subdomains <strong>go live</strong>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      You'll get a second email when a host starts answering HTTP/HTTPS probes.
                    </span>
                  </span>
                </label>

                <div>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    <Mail className="size-4" />
                    {createMutation.isPending ? "Creating…" : "Create alert"}
                  </button>
                </div>
              </form>
            </Reveal>

            <Reveal className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Your alerts</h2>
              </div>
              {subs.isLoading ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">No alerts yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {rows.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <div className="min-w-[220px] flex-1">
                        <p className="truncate text-sm font-medium">{s.email}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {FREQUENCY_LABELS[s.frequency as Frequency]} ·{" "}
                          {s.scope === "all"
                            ? "everything"
                            : s.scope === "platforms"
                              ? `${s.platform_ids?.length ?? 0} programs`
                              : `${s.domain_ids?.length ?? 0} root domains`}
                          {s.keywords?.length ? ` · keywords: ${s.keywords.join(", ")}` : ""}
                          {(s as { notify_live?: boolean }).notify_live ? " · live alerts" : ""}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        last sent {s.last_sent_at ? timeAgo(s.last_sent_at) : "never"} ·{" "}
                        {Number(s.sent_count ?? 0).toLocaleString()} hosts
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => sendMutation.mutate(s.id)}
                          disabled={sendMutation.isPending}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-60"
                        >
                          <Send className="size-3" /> Send now
                        </button>
                        <button
                          onClick={() =>
                            toggleMutation.mutate({ id: s.id, is_active: !s.is_active })
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-accent"
                        >
                          {s.is_active ? (
                            <>
                              <Pause className="size-3" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="size-3" /> Resume
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="size-3" /> Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Reveal>
          </>
        )}
      </div>
    </SiteShell>
  );
}
