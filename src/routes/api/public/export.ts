import { createFileRoute } from "@tanstack/react-router";

const PAGE = 1000;

export const Route = createFileRoute("/api/public/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const platform = url.searchParams.get("platform");
        const domain = url.searchParams.get("domain");
        const rawScope = url.searchParams.get("scope");
        const scope = rawScope === "new" || rawScope === "inactive" ? rawScope : "all";
        const hours = Number(url.searchParams.get("hours") ?? 24);
        const search = (url.searchParams.get("search") ?? "").trim();
        const rawFormat = url.searchParams.get("format");
        const format = rawFormat === "csv" || rawFormat === "json" ? rawFormat : "txt";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let domainIds: string[] | null = null;
        if (domain) {
          const { data } = await supabaseAdmin
            .from("domains")
            .select("id")
            .eq("domain", domain.toLowerCase());
          domainIds = (data ?? []).map((d) => d.id);
        } else if (platform) {
          const { data: p } = await supabaseAdmin
            .from("platforms")
            .select("id")
            .eq("slug", platform)
            .maybeSingle();
          if (!p) return new Response("Unknown platform", { status: 404 });
          const ids: string[] = [];
          for (let page = 0; page < 100; page++) {
            const { data } = await supabaseAdmin
              .from("domains")
              .select("id")
              .eq("platform_id", p.id)
              .range(page * PAGE, page * PAGE + PAGE - 1);
            ids.push(...(data ?? []).map((d) => d.id));
            if (!data || data.length < PAGE) break;
          }
          domainIds = ids;
        }

        if (domainIds && domainIds.length === 0) {
          return new Response("", { headers: { "Content-Type": "text/plain" } });
        }

        const encoder = new TextEncoder();
        let wroteJson = false;
        const stream = new ReadableStream({
          async start(controller) {
            try {
              let from = 0;
              for (let page = 0; page < 5000; page++) {
                let q = supabaseAdmin
                  .from("subdomains")
                  .select("host, first_seen_at, last_seen_at, is_active")
                  .order("host", { ascending: true })
                  .range(from, from + PAGE - 1);
                if (domainIds) q = q.in("domain_id", domainIds);
                if (search) q = q.ilike("host", `%${search}%`);
                if (scope === "inactive") q = q.eq("is_active", false);
                if (scope === "new")
                  q = q.gte(
                    "first_seen_at",
                    new Date(Date.now() - hours * 3600_000).toISOString(),
                  );
                const { data, error } = await q;
                if (error) throw new Error(error.message);
                if (!data || data.length === 0) break;
                if (format === "csv") {
                  if (page === 0)
                    controller.enqueue(
                      encoder.encode("host,first_seen_at,last_seen_at,is_active\n"),
                    );
                  controller.enqueue(
                    encoder.encode(
                      data
                        .map(
                          (r) =>
                            `${r.host},${r.first_seen_at},${r.last_seen_at},${r.is_active}`,
                        )
                        .join("\n") + "\n",
                    ),
                  );
                } else if (format === "json") {
                  const body = data.map((r) => JSON.stringify(r)).join(",\n");
                  controller.enqueue(encoder.encode((page === 0 ? "[\n" : ",\n") + body));
                  wroteJson = true;
                } else {
                  controller.enqueue(encoder.encode(data.map((r) => r.host).join("\n") + "\n"));
                }
                if (data.length < PAGE) break;
                from += PAGE;
              }
            } catch (e) {
              controller.enqueue(
                encoder.encode(`\n# export error: ${e instanceof Error ? e.message : e}\n`),
              );
            }
            if (format === "json") controller.enqueue(encoder.encode(wroteJson ? "\n]\n" : "[]\n"));
            controller.close();
          },
        });

        const name = domain ?? platform ?? "all";
        return new Response(stream, {
          headers: {
            "Content-Type":
              format === "json"
                ? "application/json; charset=utf-8"
                : format === "csv"
                  ? "text/csv; charset=utf-8"
                  : "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${name}-${scope}-subdomains.${format}"`,
          },
        });
      },
    },
  },
});
