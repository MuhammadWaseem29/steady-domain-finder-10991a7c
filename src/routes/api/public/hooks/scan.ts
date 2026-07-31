import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/scan")({
  server: {
    handlers: {
      POST: async () => {
        const { scanAllEnabledDomains } = await import("@/lib/chaos.server");
        const results = await scanAllEnabledDomains("cron");
        return Response.json({ ok: true, results });
      },
    },
  },
});
