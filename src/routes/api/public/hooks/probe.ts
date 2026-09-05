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

        const { processProbeJobs } = await import("@/lib/probe.server");
        const result = await processProbeJobs(budgetMs);
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
