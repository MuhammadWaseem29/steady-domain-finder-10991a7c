/** Navigation model shared by the API reference shell and prev/next links. */
import { API_ENDPOINTS, API_GROUPS, type ApiEndpoint } from "@/lib/api-spec";

export const SITE_ORIGIN = "https://chaos.thescope.top";

export type NavItem =
  | { kind: "page"; to: string; label: string }
  | { kind: "endpoint"; to: string; label: string; endpoint: ApiEndpoint };

export type NavSection = { title: string; items: NavItem[] };

const GUIDE_PAGES: NavItem[] = [
  { kind: "page", to: "/docs/api", label: "Overview" },
  { kind: "page", to: "/docs/api/quickstart", label: "Quickstart" },
  { kind: "page", to: "/docs/api/authentication", label: "Authentication" },
  { kind: "page", to: "/docs/api/pagination", label: "Pagination" },
  { kind: "page", to: "/docs/api/errors", label: "Errors" },
  { kind: "page", to: "/docs/api/guides", label: "Recipes" },
  { kind: "page", to: "/docs/api/changelog", label: "Changelog" },
];

export const NAV_SECTIONS: NavSection[] = [
  { title: "Get started", items: GUIDE_PAGES },
  ...API_GROUPS.map((group) => ({
    title: group,
    items: API_ENDPOINTS.filter((e) => e.group === group).map(
      (endpoint): NavItem => ({
        kind: "endpoint",
        to: `/docs/api/reference/${endpoint.id}`,
        label: endpoint.summary,
        endpoint,
      }),
    ),
  })).filter((section) => section.items.length > 0),
];

export const FLAT_NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function neighbours(pathname: string): { prev: NavItem | null; next: NavItem | null } {
  const i = FLAT_NAV.findIndex((item) => item.to === pathname);
  if (i === -1) return { prev: null, next: null };
  return { prev: FLAT_NAV[i - 1] ?? null, next: FLAT_NAV[i + 1] ?? null };
}

/** Absolute API base for the running origin (SSR falls back to the public site). */
export function apiBase(): string {
  const origin = typeof window === "undefined" ? SITE_ORIGIN : window.location.origin;
  return `${origin}/api/v1`;
}
