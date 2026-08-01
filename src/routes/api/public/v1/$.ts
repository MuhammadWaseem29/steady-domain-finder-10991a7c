import { createFileRoute } from "@tanstack/react-router";

// Mirror of /api/v1/* under the public prefix so external callers are never
// intercepted by the published-site gate. Same token auth is enforced inside.
export const Route = createFileRoute("/api/public/v1/$")({
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
