import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/probe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const suppliedKey = request.headers.get("apikey");
        const expectedKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        const suppliedSecret = request.headers.get("x-cron-secret");
        const expectedSecret = process.env["CRON_HOOK_SECRET"];
        const authorized =
          (!!expectedKey && suppliedKey === expectedKey) ||
          (!!expectedSecret && suppliedSecret === expectedSecret);
        if (!authorized) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const budgetMs = Math.min(Number(url.searchParams.get("budgetMs") ?? 50000), 55000);

        const workers = Math.min(Math.max(Number(url.searchParams.get("workers") ?? 3), 1), 6);
        const fanout = Math.min(Math.max(Number(url.searchParams.get("fanout") ?? 0), 0), 12);
        const { processProbeJobs, ensureAutoProbeJob } = await import("@/lib/probe.server");
        await ensureAutoProbeJob();

        // Fan out into separate invocations: each one gets its own outbound
        // connection budget, which is what actually multiplies throughput.
        if (fanout > 0) {
          const child = new URL(url.toString());
          child.searchParams.delete("fanout");
          child.searchParams.set("workers", String(workers));
          const headers: Record<string, string> = {};
          if (suppliedKey) headers["apikey"] = suppliedKey;
          if (suppliedSecret) headers["x-cron-secret"] = suppliedSecret;
          const spawned = Array.from({ length: fanout }, () =>
            fetch(child.toString(), { method: "POST", headers }).catch(() => undefined),
          );
          const settled = await Promise.all(spawned);
          let probedTotal = 0;
          for (const res of settled) {
            if (!res?.ok) continue;
            const body = (await res.json().catch(() => null)) as { probed?: number } | null;
            probedTotal += body?.probed ?? 0;
          }
          return Response.json({ ok: true, fanout, workers, probed: probedTotal });
        }

        const results = await Promise.all(
          Array.from({ length: workers }, () => processProbeJobs(budgetMs)),
        );
        const probed = results.reduce((sum, r) => sum + r.probed, 0);
        return Response.json({
          ok: true,
          workers,
          probed,
          jobs: results.map((r) => r.jobId).filter(Boolean),
        });
      },
    },
  },
});
