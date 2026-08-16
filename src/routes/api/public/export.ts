import { createFileRoute } from "@tanstack/react-router";

const PAGE = 1000;

export const Route = createFileRoute("/api/public/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const platform = url.searchParams.get("platform");
        const domain = url.searchParams.get("domain");
        const domainsParam = url.searchParams.get("domains");
        const rawScope = url.searchParams.get("scope");
        const scope = rawScope === "new" || rawScope === "inactive" ? rawScope : "all";
        const hours = Number(url.searchParams.get("hours") ?? 24);
        const sinceParam = url.searchParams.get("since");
        const untilParam = url.searchParams.get("until");
        const keyword = (url.searchParams.get("keyword") ?? "").trim();
        const search = (url.searchParams.get("search") ?? "").trim();
        const rawFormat = url.searchParams.get("format");
        const format = rawFormat === "csv" || rawFormat === "json" ? rawFormat : "txt";

        const sinceIso =
          sinceParam && !Number.isNaN(Date.parse(sinceParam))
            ? new Date(sinceParam).toISOString()
            : new Date(Date.now() - (Number.isFinite(hours) ? hours : 24) * 3600_000).toISOString();
        const untilIso =
          untilParam && !Number.isNaN(Date.parse(untilParam))
            ? new Date(untilParam).toISOString()
            : null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let domainIds: string[] | null = null;
        const wanted = domainsParam
          ? domainsParam
              .split(",")
              .map((d) => d.trim().toLowerCase())
              .filter(Boolean)
          : domain
            ? [domain.toLowerCase()]
            : [];
        if (wanted.length) {
          const ids: string[] = [];
          for (let i = 0; i < wanted.length; i += 100) {
            const { data } = await supabaseAdmin
              .from("domains")
              .select("id")
              .in("domain", wanted.slice(i, i + 100));
            ids.push(...(data ?? []).map((d) => d.id));
          }
          domainIds = ids;
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
        // Chunk domain ids: a single .in() with thousands of uuids blows the
        // PostgREST URL length limit and fails with an empty error message.
        const ID_CHUNK = 40;
        const chunks: (string[] | null)[] = domainIds
          ? Array.from({ length: Math.ceil(domainIds.length / ID_CHUNK) }, (_, i) =>
              domainIds.slice(i * ID_CHUNK, i * ID_CHUNK + ID_CHUNK),
            )
          : [null];

        const stream = new ReadableStream({
          async start(controller) {
            let emitted = 0;
            try {
              for (const ids of chunks) {
                let from = 0;
                for (let page = 0; page < 5000; page++) {
                  let q = supabaseAdmin
                    .from("subdomains")
                    .select("host, first_seen_at, last_seen_at, is_active")
                    .order("host", { ascending: true })
                    .range(from, from + PAGE - 1);
                  if (ids) q = q.in("domain_id", ids);
                  if (search) q = q.ilike("host", `%${search}%`);
                  if (scope === "inactive") q = q.eq("is_active", false);
                  if (scope === "new")
                    q = q.gte(
                      "first_seen_at",
                      new Date(Date.now() - hours * 3600_000).toISOString(),
                    );
                  const { data, error } = await q;
                  if (error) throw new Error(error.message || "database error");
                  if (!data || data.length === 0) break;
                  if (format === "csv") {
                    if (emitted === 0)
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
                    controller.enqueue(encoder.encode((emitted === 0 ? "[\n" : ",\n") + body));
                    wroteJson = true;
                  } else {
                    controller.enqueue(encoder.encode(data.map((r) => r.host).join("\n") + "\n"));
                  }
                  emitted += data.length;
                  if (data.length < PAGE) break;
                  from += PAGE;
                }
              }
            } catch (e) {
              controller.enqueue(
                encoder.encode(
                  `\n# export error: ${e instanceof Error ? e.message : String(e)}\n`,
                ),
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
