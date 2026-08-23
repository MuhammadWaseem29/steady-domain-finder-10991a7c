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

        return Response.json({ ok: true, job, scanned, newCount, errors, reconciled, alerts });


      },
    },
  },
});
