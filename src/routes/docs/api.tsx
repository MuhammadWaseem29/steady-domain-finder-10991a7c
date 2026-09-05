import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/chrome";

export const Route = createFileRoute("/docs/api")({
  component: ApiDocsLayout,
});

function ApiDocsLayout() {
  return (
    <SiteShell>
      <Outlet />
    </SiteShell>
  );
}
