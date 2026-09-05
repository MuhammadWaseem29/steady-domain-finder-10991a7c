import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { API_ENDPOINTS } from "@/lib/api-spec";

const BASE_URL = "https://chaos.thescope.top";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          { path: "/chaos_updates", changefreq: "hourly", priority: "0.9" },
          { path: "/recentsubs", changefreq: "hourly", priority: "0.9" },
          { path: "/updates", changefreq: "hourly", priority: "0.8" },
          { path: "/programs", changefreq: "daily", priority: "0.8" },
          { path: "/stats", changefreq: "daily", priority: "0.7" },
          { path: "/queue", changefreq: "hourly", priority: "0.5" },
          { path: "/new", changefreq: "hourly", priority: "0.6" },
          { path: "/docs/api", changefreq: "weekly", priority: "0.7" },
          { path: "/docs/api/quickstart", changefreq: "weekly", priority: "0.6" },
          { path: "/docs/api/authentication", changefreq: "weekly", priority: "0.6" },
          { path: "/docs/api/pagination", changefreq: "weekly", priority: "0.5" },
          { path: "/docs/api/errors", changefreq: "weekly", priority: "0.5" },
          { path: "/docs/api/guides", changefreq: "weekly", priority: "0.6" },
          { path: "/docs/api/changelog", changefreq: "weekly", priority: "0.4" },
          ...API_ENDPOINTS.map(
            (e): SitemapEntry => ({
              path: `/docs/api/reference/${e.id}`,
              changefreq: "weekly",
              priority: "0.5",
            }),
          ),
          { path: "/docs/api-key", changefreq: "weekly", priority: "0.6" },
          { path: "/docs/fetch-subdomains", changefreq: "weekly", priority: "0.6" },
          { path: "/auth", changefreq: "monthly", priority: "0.3" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
