import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleApiV1 } = await import("@/lib/api-v1.server");
        return handleApiV1(request, params._splat ?? "");
      },
      POST: async ({ request, params }) => {
        const { handleApiV1 } = await import("@/lib/api-v1.server");
        return handleApiV1(request, params._splat ?? "");
      },
      OPTIONS: async ({ request, params }) => {
        const { handleApiV1 } = await import("@/lib/api-v1.server");
        return handleApiV1(request, params._splat ?? "");
      },
    },
  },
});
