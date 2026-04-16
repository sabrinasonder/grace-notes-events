import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronRight,
  LogOut,
  User,
  CreditCard,
  Bell,
  Users,
  HelpCircle,
  UserPlus,
  Archive,
  ShieldCheck,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

const formatCollected = (cents: number) => {
  const d = cents / 100;
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}k`;
  return `$${d.toFixed(0)}`;
};

const Settings = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is_admin", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("has_role", { user_id: user!.id, role: "admin" });
      return !!data;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["settings_stats", user?.id],
    queryFn: async () => {
      const [
        { count: hosted },
        { count: attended },
        { data: hostedWithPayments },
      ] = await Promise.all([
        supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("host_id", user!.id),
        supabase
          .from("rsvps")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("status", "going"),
        supabase
          .from("events")
          .select("payments(amount_cents, status)")
          .eq("host_id", user!.id),
      ]);
      const collected = (hostedWithPayments ?? [])
        .flatMap((e: any) => e.payments ?? [])
        .filter((p: any) => p.status === "completed")
        .reduce((sum: number, p: any) => sum + p.amount_cents, 0);
      return { hosted: hosted ?? 0, attended: attended ?? 0, collected };
    },
    enabled: !!user,
  });

  if (authLoading) return null;
  if (!user) {
    navigate("/join");
    return null;
  }

  const initials = (profile?.full_name || user.email || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const memberYear = profile?.created_at
    ? `'${new Date(profile.created_at).getFullYear().toString().slice(2)}`
    : null;

  const menuItems = [
    { label: "Account", icon: User, path: "/settings/account" },
    { label: "Payment methods", icon: CreditCard, path: "/settings/payment" },
    { label: "Notifications", icon: Bell, path: "/settings/notifications" },
    { label: "Your circle", icon: Users, path: "/settings/circle" },
    { label: "Archive", icon: Archive, path: "/archive" },
    { label: "Invite a friend", icon: UserPlus, path: "/invite" },
    { label: "Help & feedback", icon: HelpCircle, path: "/settings/help" },
    ...(isAdmin ? [{ label: "Member approvals", icon: ShieldCheck, path: "/admin/members" }] : []),
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Profile header */}
      <div className="mx-auto max-w-lg px-6 pt-14 pb-8 flex flex-col items-center text-center">
        <div className="h-20 w-20 rounded-full bg-blush flex items-center justify-center mb-5 overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-serif text-2xl text-white">{initials}</span>
          )}
        </div>
        <h1 className="font-serif text-[28px] leading-tight text-espresso mb-1.5">
          {profile?.full_name || user.email}
        </h1>
        {(profile?.city || memberYear) && (
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-taupe">
            {[profile?.city, memberYear ? `Member since ${memberYear}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="mx-auto max-w-lg px-6 pb-8">
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: stats?.hosted ?? "—", label: "Hosted" },
            { value: stats?.attended ?? "—", label: "Attended" },
            {
              value: stats != null ? formatCollected(stats.collected) : "—",
              label: "Collected",
            },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="rounded-2xl bg-paper border border-cream py-4 text-center"
            >
              <p className="font-serif text-2xl text-espresso">{value}</p>
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.22em] text-taupe mt-1">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Menu list */}
      <div className="mx-auto max-w-lg px-6">
        <div className="divide-y divide-cream">
          {menuItems.map(({ label, icon: Icon, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex w-full items-center gap-3 py-4 text-left group"
            >
              <Icon
                className="h-4 w-4 text-taupe shrink-0"
                strokeWidth={1.5}
              />
              <span className="flex-1 font-sans text-[15px] text-espresso">
                {label}
              </span>
              <ChevronRight className="h-4 w-4 text-taupe" strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div className="mx-auto max-w-lg px-6 mt-8">
        <button
          onClick={async () => {
            await signOut();
            navigate("/join");
          }}
          className="flex w-full items-center gap-2 rounded-2xl border border-cream bg-paper px-4 py-3.5 transition-colors hover:bg-cream"
        >
          <LogOut className="h-4 w-4 text-destructive" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-destructive">Sign out</span>
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
