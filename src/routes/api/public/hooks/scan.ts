import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") ?? 200);
        const concurrency = Number(url.searchParams.get("concurrency") ?? 6);

        const { scanAllEnabledDomains } = await import("@/lib/chaos.server");
        const results = await scanAllEnabledDomains("cron", { limit, concurrency });

        const scanned = results.length;
        const newCount = results.reduce((a, r) => a + r.newCount, 0);
        const errors = results.filter((r) => r.status === "error").length;

        return Response.json({ ok: true, scanned, newCount, errors });
      },
    },
  },
});
