import { createFileRoute } from "@tanstack/react-router";

// Pretty mirror of /api/public/raw/* so hosts can be fetched at /raw/{domain}.
export const Route = createFileRoute("/raw/$")({
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
