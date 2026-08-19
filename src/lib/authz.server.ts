/** Server-only authorization helpers: admin role checks backed by public.user_roles. */

export async function isAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) {
    console.error("[authz] role lookup failed:", error.message);
    return false;
  }
  return Boolean(data);
}

/** Throws when the caller is not an administrator. */
export async function requireAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) {
    throw new Error("Forbidden: this action requires an administrator account");
  }
}
