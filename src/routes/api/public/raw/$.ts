import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/raw/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleRawExport } = await import("@/lib/raw-export.server");
        return handleRawExport(request, params._splat ?? "");
      },
      OPTIONS: async ({ request, params }) => {
        const { handleRawExport } = await import("@/lib/raw-export.server");
        return handleRawExport(request, params._splat ?? "");
      },
    },
  },
});
