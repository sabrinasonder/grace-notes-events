/**
 * /admin/members — admin-only approval dashboard
 *
 * Shows all pending membership_requests with Approve / Deny actions.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";

const AdminMembers = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ["is_admin", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("has_role", { user_id: user!.id, role: "admin" });
      return !!data;
    },
    enabled: !!user,
  });

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["membership_requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("membership_requests")
        .select("*, profiles:user_id(full_name, email:id)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!isAdmin,
  });

  // Fetch emails from auth.users via profiles table (email stored in profiles or auth.users)
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_for_requests", requests.map((r: any) => r.user_id)],
    queryFn: async () => {
      const ids = requests.map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      return data ?? [];
    },
    enabled: requests.length > 0,
  });

  const [actingOn, setActingOn] = useState<string | null>(null);

  const resolveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "denied" }) => {
      const { error } = await (supabase as any)
        .from("membership_requests")
        .update({ status, resolved_at: new Date().toISOString(), resolved_by: user!.id })
        .eq("id", id);
      if (error) throw error;

      // If approved, add the user to the 'member' role
      if (status === "approved") {
        const req = requests.find((r: any) => r.id === id);
        if (req) {
          await (supabase as any)
            .from("user_roles")
            .insert({ user_id: req.user_id, role: "member" })
            .onConflict("user_id, role")
            .ignore();
        }
      }
    },
    onSuccess: (_, { status }) => {
      toast({ title: status === "approved" ? "Member approved!" : "Request denied" });
      qc.invalidateQueries({ queryKey: ["membership_requests"] });
      setActingOn(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setActingOn(null);
    },
  });

  if (authLoading || adminLoading) return null;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const pending = requests.filter((r: any) => r.status === "pending");
  const resolved = requests.filter((r: any) => r.status !== "pending");

  const profileFor = (userId: string) =>
    profiles.find((p: any) => p.id === userId);

  const handleResolve = (id: string, status: "approved" | "denied") => {
    setActingOn(id);
    resolveMutation.mutate({ id, status });
  };

  const renderRow = (req: any, showActions: boolean) => {
    const profile = profileFor(req.user_id);
    const name = profile?.full_name || "Unknown";
    const initials = name.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
    const date = new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return (
      <div key={req.id} className="flex items-center gap-3 py-3.5 border-b border-cream last:border-0">
        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-blush flex items-center justify-center shrink-0 overflow-hidden">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            : <span className="font-serif text-sm text-white">{initials}</span>}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-serif text-[15px] text-espresso truncate">{name}</p>
          <p className="font-sans text-[11px] text-taupe mt-0.5">
            {req.invite_code
              ? `Invite code · ${date}`
              : `Direct signup · ${date}`}
          </p>
        </div>

        {/* Actions / status */}
        {showActions ? (
          <div className="flex items-center gap-2 shrink-0">
            {actingOn === req.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-taupe" strokeWidth={1.5} />
            ) : (
              <>
                <button
                  onClick={() => handleResolve(req.id, "denied")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-cream text-taupe transition-colors hover:bg-cream"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                <button
                  onClick={() => handleResolve(req.id, "approved")}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-cocoa text-background transition-opacity hover:opacity-80"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </>
            )}
          </div>
        ) : (
          <span className={`font-sans text-[10px] font-semibold uppercase tracking-[0.18em] ${
            req.status === "approved" ? "text-sage" : "text-destructive/60"
          }`}>
            {req.status}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-cream bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-lg flex items-center px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cream transition-colors hover:bg-cream/80"
          >
            <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>
          <h1 className="flex-1 text-center font-serif text-lg text-espresso">
            Member Approvals
          </h1>
          <div className="h-10 w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6 pt-8 space-y-8">
        {/* Pending */}
        <div className="space-y-3">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
            Pending · {pending.length}
          </p>
          {requestsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-taupe" strokeWidth={1.5} />
            </div>
          ) : pending.length === 0 ? (
            <div className="rounded-2xl border border-cream bg-paper px-4 py-8 text-center">
              <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-taupe/40" strokeWidth={1.5} />
              <p className="font-serif italic text-[15px] text-taupe">All caught up</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-cream bg-paper px-4">
              {pending.map((r: any) => renderRow(r, true))}
            </div>
          )}
        </div>

        {/* Resolved */}
        {resolved.length > 0 && (
          <div className="space-y-3">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
              Resolved · {resolved.length}
            </p>
            <div className="rounded-2xl border border-cream bg-paper px-4">
              {resolved.map((r: any) => renderRow(r, false))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default AdminMembers;
