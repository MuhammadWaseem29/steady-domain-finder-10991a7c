/** Server-only helpers for the public REST API's bearer-token authentication. */

const PREFIX = "chs_live_";

export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${PREFIX}${hex}`;
}

export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type ApiCaller = { keyId: string; userId: string };

export async function authenticateApiRequest(
  request: Request,
): Promise<{ caller: ApiCaller } | { error: Response }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : (request.headers.get("x-api-key") ?? "").trim();

  if (!token) {
    return {
      error: apiError(401, "missing_token", "Provide an API token: Authorization: Bearer chs_live_…"),
    };
  }
  if (!token.startsWith(PREFIX)) {
    return { error: apiError(401, "invalid_token", "Malformed API token.") };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, revoked")
    .eq("key_hash", await hashApiKey(token))
    .maybeSingle();

  if (error) return { error: apiError(500, "auth_failed", "Could not verify the API token.") };
  if (!data) return { error: apiError(401, "invalid_token", "Unknown API token.") };
  if (data.revoked) return { error: apiError(401, "revoked_token", "This API token was revoked.") };

  void supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined);

  return { caller: { keyId: data.id, userId: data.user_id } };
}

export function apiError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: corsHeaders() });
}

export function apiJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders() });
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}
