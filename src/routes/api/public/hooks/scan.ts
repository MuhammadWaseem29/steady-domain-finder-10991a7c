import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const suppliedKey = request.headers.get("apikey");
        const expectedKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        const suppliedSecret = request.headers.get("x-cron-secret");
        const expectedSecret = process.env["CRON_HOOK_SECRET"];
        const authorized =
          (!!expectedKey && suppliedKey === expectedKey) ||
          (!!expectedSecret && suppliedSecret === expectedSecret);
        if (!authorized) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") ?? 400);
        const concurrency = Number(url.searchParams.get("concurrency") ?? 40);
        const budgetMs = Number(url.searchParams.get("budgetMs") ?? 50000);
        const cycleMinutes = Number(url.searchParams.get("cycleMinutes") ?? 120);
        const jobBudgetMs = Number(url.searchParams.get("jobBudgetMs") ?? 20000);

        const { processPendingScanJobs, scanAllEnabledDomains } = await import("@/lib/chaos.server");
        const started = Date.now();
        const job = await processPendingScanJobs(Math.min(jobBudgetMs, budgetMs));
        const remaining = budgetMs - (Date.now() - started);
        const results = remaining > 8000
          ? await scanAllEnabledDomains("cron", { limit, concurrency, budgetMs: remaining, cycleMinutes })
          : [];


        // Self-heal: repair scan rows whose discoveries were written by a
        // worker that got cut off before it could record them.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: reconciled } = await supabaseAdmin.rpc("reconcile_scan_counts", {
          _since: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        });

        // Live-host probes: work one batch per tick within the leftover budget.
        let probe: { jobId: string | null; probed: number } = { jobId: null, probed: 0 };
        try {
          const { processProbeJobs, ensureAutoProbeJob } = await import("@/lib/probe.server");
          await ensureAutoProbeJob();
          const probeBudget = Math.min(Math.max(budgetMs - (Date.now() - started), 3000), 15000);
          // Fan the probe work out into sibling invocations so several batches of
          // hosts are checked at the same time, then do one batch here too.
          const origin = new URL(request.url).origin;
          const probeUrl = `${origin}/api/public/hooks/probe?workers=4&budgetMs=${probeBudget}`;
          const headers: Record<string, string> = {};
          const apikey = request.headers.get("apikey");
          const cronSecret = request.headers.get("x-cron-secret");
          if (apikey) headers["apikey"] = apikey;
          if (cronSecret) headers["x-cron-secret"] = cronSecret;
          const siblings = Array.from({ length: 5 }, () =>
            fetch(probeUrl, { method: "POST", headers })
              .then((r) => (r.ok ? (r.json() as Promise<{ probed?: number }>) : null))
              .catch(() => null),
          );
          const [mine, ...rest] = await Promise.all([
            processProbeJobs(probeBudget),
            ...siblings,
          ]);
          probe = {
            jobId: (mine as { jobId: string | null }).jobId,
            probed:
              (mine as { probed: number }).probed +
              rest.reduce((sum, r) => sum + ((r as { probed?: number } | null)?.probed ?? 0), 0),
          };
        } catch (err) {
          console.error("probe tick failed:", err);
        }

        // Email alerts for freshly discovered hosts, within the leftover budget.
        let alerts: { processed: number; sent: number } = { processed: 0, sent: 0 };
        try {
          const { dispatchDueAlerts } = await import("@/lib/alerts.server");
          alerts = await dispatchDueAlerts(Math.max(budgetMs - (Date.now() - started), 3000));
        } catch (err) {
          console.error("alert dispatch tick failed:", err);
        }

        const scanned = results.length;
        const newCount = results.reduce((a, r) => a + r.newCount, 0);
        const errors = results.filter((r) => r.status === "error").length;

        return Response.json({ ok: true, job, scanned, newCount, errors, reconciled, probe, alerts });


      },
    },
  },
});
