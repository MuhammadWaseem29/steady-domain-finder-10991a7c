import { createFileRoute } from "@tanstack/react-router";

const PAGE = 1000;

export const Route = createFileRoute("/api/public/roots")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
          },
        }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const platform = (url.searchParams.get("platform") ?? "").trim().toLowerCase();
        const rawFormat = url.searchParams.get("format");
        const format = rawFormat === "csv" || rawFormat === "json" ? rawFormat : "txt";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let platformId: string | null = null;
        let platformSlug = "all";
        if (platform) {
          const { data: p } = await supabaseAdmin
            .from("platforms")
            .select("id, slug")
            .eq("slug", platform)
            .maybeSingle();
          if (!p) {
            return new Response("Unknown platform", {
              status: 404,
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
              },
            });
          }
          platformId = p.id;
          platformSlug = p.slug;
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            let emitted = 0;
            try {
              let from = 0;
              for (let page = 0; page < 5000; page++) {
                let q = supabaseAdmin
                  .from("domains")
                  .select("domain, total_subdomains")
                  .order("domain", { ascending: true })
                  .range(from, from + PAGE - 1);
                if (platformId) q = q.eq("platform_id", platformId);
                const { data, error } = await q;
                if (error) throw new Error(error.message || "database error");
                if (!data || data.length === 0) break;
                if (format === "csv") {
                  if (emitted === 0)
                    controller.enqueue(encoder.encode("domain,platform,subdomain_count\n"));
                  controller.enqueue(
                    encoder.encode(
                      data
                        .map((r) => `${r.domain},${platformSlug},${r.total_subdomains ?? 0}`)
                        .join("\n") + "\n",
                    ),
                  );
                } else if (format === "json") {
                  const body = data
                    .map((r) =>
                      JSON.stringify({
                        domain: r.domain,
                        platform: platformSlug,
                        subdomain_count: r.total_subdomains ?? 0,
                      }),
                    )
                    .join(",\n");
                  controller.enqueue(encoder.encode((emitted === 0 ? "[\n" : ",\n") + body));
                } else {
                  controller.enqueue(encoder.encode(data.map((r) => r.domain).join("\n") + "\n"));
                }
                emitted += data.length;
                if (data.length < PAGE) break;
                from += PAGE;
              }
            } catch (e) {
              controller.enqueue(
                encoder.encode(`\n# error: ${e instanceof Error ? e.message : String(e)}\n`),
              );
            }
            if (format === "json") controller.enqueue(encoder.encode(emitted === 0 ? "[]\n" : "\n]\n"));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type":
              format === "json"
                ? "application/json; charset=utf-8"
                : format === "csv"
                  ? "text/csv; charset=utf-8"
                  : "text/plain; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Content-Disposition": `attachment; filename="${platformSlug}-root-domains.${format}"`,
          },
        });
      },
    },
  },
});
