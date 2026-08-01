import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type SessionState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
};

/** Client-side session state. Public pages stay readable; actions gate on `user`. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    session: null,
    user: null,
  });

  useEffect(() => {
    let alive = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setState({ loading: false, session, user: session?.user ?? null });
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setState({ loading: false, session: data.session, user: data.session?.user ?? null });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function displayNameOf(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const name = (meta?.["full_name"] ?? meta?.["name"]) as string | undefined;
  return name || user.email || "Account";
}
