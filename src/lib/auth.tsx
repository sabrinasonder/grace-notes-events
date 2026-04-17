import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type MembershipStatus = "pending" | "approved" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  membershipStatus: MembershipStatus;
  refreshMembership: () => Promise<void>;
  signInWithMagicLink: (email: string, options?: { emailRedirectTo?: string }) => Promise<{ error: Error | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Fetches membership status purely from the membership_requests table.
 * Only called lazily — never blocks the initial auth load.
 * Returns null (don't gate) on any error so failures are always safe.
 */
async function fetchMembershipStatus(userId: string): Promise<MembershipStatus> {
  try {
    // Users with any role (member/admin) are always approved
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (roleRow) return "approved";

    // No role found — check membership_requests (new signups only)
    const { data, error } = await (supabase as any)
      .from("membership_requests")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null; // table not deployed yet or no row → don't gate
    return data.status === "approved" ? "approved" : "pending";
  } catch {
    return null; // any failure → don't gate
  }
}

/**
 * Creates a membership_requests row for brand-new signups (no existing role).
 * Never runs for users who already have a user_roles entry.
 */
async function processNewSignup(userId: string) {
  try {
    // Skip entirely for existing members/admins
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (roleRow) return;

    const code = localStorage.getItem("sonder_invite_code");
    const ref = localStorage.getItem("sonder_invite_ref");

    // Don't create a duplicate row
    const { data: existing } = await (supabase as any)
      .from("membership_requests")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return;

    // Auto-approve users who joined via an invite code or event link
    const viaEventLink = localStorage.getItem("sonder_via_event_link") === "true";
    const status = (code || viaEventLink) ? "approved" : "pending";

    const payload: Record<string, any> = { user_id: userId, status };
    if (code) {
      payload.invite_code = code;
      const { data: inv } = await (supabase as any)
        .from("invites")
        .select("inviter_id")
        .eq("token", code)
        .maybeSingle();
      if (inv?.inviter_id) payload.invited_by = inv.inviter_id;
    } else if (ref) {
      payload.invited_by = ref;
    }

    await (supabase as any).from("membership_requests").insert(payload);
  } catch {
    // membership_requests table not deployed yet — safe to ignore
  } finally {
    localStorage.removeItem("sonder_invite_code");
    localStorage.removeItem("sonder_invite_ref");
    localStorage.removeItem("sonder_via_event_link");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>(null);

  const refreshMembership = useCallback(async () => {
    if (!user) return;
    const status = await fetchMembershipStatus(user.id);
    setMembershipStatus(status);
  }, [user]);

  useEffect(() => {
    // Handle auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Set auth state synchronously — never await here to avoid blocking
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (_event === "SIGNED_OUT") {
          setMembershipStatus(null);
        }

        // Do membership work asynchronously, completely decoupled from auth loading
        if (_event === "SIGNED_IN" && session?.user) {
          const uid = session.user.id;
          setTimeout(() => {
            processNewSignup(uid).catch(() => {});
            fetchMembershipStatus(uid).then(setMembershipStatus).catch(() => {});
          }, 0);
        }
      }
    );

    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        // Fetch membership status in the background — never blocks rendering
        fetchMembershipStatus(session.user.id)
          .then(setMembershipStatus)
          .catch(() => {});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithMagicLink = async (email: string, options?: { emailRedirectTo?: string }) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: options?.emailRedirectTo ?? window.location.origin,
        shouldCreateUser: true, // TODO: set back to false before launch
      },
    });
    return { error: error as Error | null };
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    return { error: error as Error | null };
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      membershipStatus,
      refreshMembership,
      signInWithMagicLink,
      verifyOtp,
      signInWithPassword,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
