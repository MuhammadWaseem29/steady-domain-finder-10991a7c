// Tiny filter DSL shared by the /chaos_updateed workbench, the grid and the
// host worker. Pure functions only — safe to import from a Web Worker.

export type ParsedQuery = {
  include: string[];
  exclude: string[];
  regex: { re: string; flags: string }[];
  notRegex: { re: string; flags: string }[];
  platform: string | null;
  minNew: number | null;
  minTotal: number | null;
  limit: number | null;
  sort: "host" | "len" | "none";
  unique: boolean;
  errors: string[];
};

export const EMPTY_QUERY: ParsedQuery = {
  include: [],
  exclude: [],
  regex: [],
  notRegex: [],
  platform: null,
  minNew: null,
  minTotal: null,
  limit: null,
  sort: "none",
  unique: false,
  errors: [],
};

const globToRegex = (glob: string) =>
  "^" +
  glob
    .split("")
    .map((c) => (c === "*" ? ".*" : c === "?" ? "." : /[a-zA-Z0-9._-]/.test(c) ? c : `\\${c}`))
    .join("") +
  "$";

export function parseQuery(source: string): ParsedQuery {
  const q: ParsedQuery = {
    ...EMPTY_QUERY,
    include: [],
    exclude: [],
    regex: [],
    notRegex: [],
    errors: [],
  };
  for (const rawLine of source.split("\n")) {
    for (const rawToken of rawLine.split(/\s+/)) {
      let token = rawToken.trim();
      if (!token || token.startsWith("#") || token.startsWith("//")) break;

      let negate = false;
      if (token.startsWith("!")) {
        negate = true;
        token = token.slice(1);
      }
      if (!token) continue;

      const colon = token.indexOf(":");
      const key = colon > 0 ? token.slice(0, colon).toLowerCase() : "";
      const val = colon > 0 ? token.slice(colon + 1) : "";

      if (key === "platform") {
        q.platform = val.toLowerCase() || null;
        continue;
      }
      if (key === "limit") {
        const n = Number(val);
        q.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
        continue;
      }
      if (key === "sort") {
        q.sort = val === "host" || val === "len" ? val : "none";
        continue;
      }
      if (key === "unique") {
        q.unique = val !== "false";
        continue;
      }
      if (token.toLowerCase() === "unique") {
        q.unique = true;
        continue;
      }

      const cmp = /^(new|total)\s*([>=<])\s*(\d+)$/i.exec(token);
      if (cmp) {
        const n = Number(cmp[3]);
        if (cmp[1]!.toLowerCase() === "new") q.minNew = cmp[2] === "<" ? -n : n;
        else q.minTotal = n;
        continue;
      }

      if (token.startsWith("/")) {
        const end = token.lastIndexOf("/");
        if (end > 0) {
          const body = token.slice(1, end);
          const flags = token.slice(end + 1).replace(/[^gimsuy]/g, "") || "i";
          try {
            new RegExp(body, flags);
            (negate ? q.notRegex : q.regex).push({ re: body, flags });
          } catch {
            q.errors.push(`Invalid regex: ${token}`);
          }
          continue;
        }
      }

      const value = token.toLowerCase();
      if (value.includes("*") || value.includes("?")) {
        try {
          const body = globToRegex(value);
          new RegExp(body, "i");
          (negate ? q.notRegex : q.regex).push({ re: body, flags: "i" });
        } catch {
          q.errors.push(`Invalid pattern: ${token}`);
        }
        continue;
      }
      (negate ? q.exclude : q.include).push(value);
    }
  }
  return q;
}

export type CompiledQuery = {
  parsed: ParsedQuery;
  include: string[];
  exclude: string[];
  regex: RegExp[];
  notRegex: RegExp[];
};

export function compileQuery(parsed: ParsedQuery): CompiledQuery {
  return {
    parsed,
    include: parsed.include,
    exclude: parsed.exclude,
    regex: parsed.regex.map((r) => new RegExp(r.re, r.flags)),
    notRegex: parsed.notRegex.map((r) => new RegExp(r.re, r.flags)),
  };
}

export function matchHost(host: string, c: CompiledQuery): boolean {
  const h = host.toLowerCase();
  if (c.exclude.some((t) => h.includes(t))) return false;
  if (c.notRegex.some((r) => r.test(h))) return false;
  if (c.include.length && !c.include.some((t) => h.includes(t))) return false;
  if (c.regex.length && !c.regex.some((r) => r.test(h))) return false;
  return true;
}

export function matchRow(
  row: { domain: string; new_count: number; total_subdomains: number; platform_slug?: string | null },
  c: CompiledQuery,
): boolean {
  const p = c.parsed;
  if (p.platform && (row.platform_slug ?? "").toLowerCase() !== p.platform) return false;
  if (p.minNew !== null) {
    if (p.minNew >= 0 && Number(row.new_count) < p.minNew) return false;
    if (p.minNew < 0 && Number(row.new_count) > -p.minNew) return false;
  }
  if (p.minTotal !== null && Number(row.total_subdomains) < p.minTotal) return false;
  return matchHost(row.domain, c);
}

export function applyHostQuery(hosts: string[], parsed: ParsedQuery): string[] {
  const c = compileQuery(parsed);
  let out: string[] = [];
  for (const h of hosts) if (h && matchHost(h, c)) out.push(h);
  if (parsed.unique) out = Array.from(new Set(out));
  if (parsed.sort === "host") out.sort((a, b) => a.localeCompare(b));
  else if (parsed.sort === "len") out.sort((a, b) => a.length - b.length || a.localeCompare(b));
  if (parsed.limit) out = out.slice(0, parsed.limit);
  return out;
}

export type ExportFormat = "txt" | "csv" | "json" | "jsonl" | "md";

export function formatHosts(hosts: string[], format: ExportFormat): string {
  switch (format) {
    case "csv":
      return "host\n" + hosts.join("\n");
    case "json":
      return JSON.stringify(hosts, null, 2);
    case "jsonl":
      return hosts.map((h) => JSON.stringify({ host: h })).join("\n");
    case "md":
      return hosts.map((h) => `- [${h}](https://${h})`).join("\n");
    default:
      return hosts.join("\n");
  }
}

export const DSL_HELP = `# Filter DSL — one or more tokens per line
api staging            # include hosts containing any of these
!test !sandbox         # exclude
/^(dev|qa)\\./          # regex include (add ! to exclude)
*.internal.*           # glob
platform:hackerone     # only this platform (grid)
new>10  total>1000     # numeric thresholds (grid)
unique  sort:host  limit:5000
`;
