import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

const SettingsCircle = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data: circle = [], isLoading } = useQuery({
    queryKey: ["circle", user?.id],
    queryFn: async () => {
      // Get all event IDs the user has attended (going) or hosted
      const [{ data: myRsvps }, { data: hostedEvents }] = await Promise.all([
        supabase
          .from("rsvps")
          .select("event_id")
          .eq("user_id", user!.id)
          .eq("status", "going"),
        supabase
          .from("events")
          .select("id")
          .eq("host_id", user!.id),
      ]);

      const eventIds = [
        ...(myRsvps?.map((r) => r.event_id) ?? []),
        ...(hostedEvents?.map((e) => e.id) ?? []),
      ];
      const uniqueEventIds = [...new Set(eventIds)];

      if (uniqueEventIds.length === 0) return [];

      // Get other members who attended those same events
      const { data: sharedRsvps } = await supabase
        .from("rsvps")
        .select("user_id, profiles!rsvps_user_id_fkey(id, full_name, avatar_url, city)")
        .in("event_id", uniqueEventIds)
        .eq("status", "going")
        .neq("user_id", user!.id);

      // Deduplicate by user_id
      const seen = new Set<string>();
      return (sharedRsvps ?? [])
        .filter((r) => {
          if (seen.has(r.user_id)) return false;
          seen.add(r.user_id);
          return true;
        })
        .map((r) => r.profiles)
        .filter(Boolean) as {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          city: string | null;
        }[];
    },
    enabled: !!user,
  });

  if (authLoading) return null;
  if (!user) { navigate("/join"); return null; }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-20 border-b border-cream bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-lg flex items-center px-6 py-4">
          <button
            onClick={() => navigate("/settings")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cream transition-colors hover:bg-cream/80"
          >
            <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>
          <h1 className="flex-1 text-center font-serif text-lg text-espresso">
            Your Circle
          </h1>
          <div className="h-10 w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6 mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-pulse font-serif text-lg text-taupe">Loading…</div>
          </div>
        ) : circle.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-3">
            <p className="font-serif italic text-lg text-taupe">Your circle is empty for now.</p>
            <p className="font-sans text-[11px] text-taupe max-w-xs leading-relaxed">
              Members who attend the same events as you will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe mb-4">
              {circle.length} {circle.length === 1 ? "member" : "members"}
            </p>
            <div className="divide-y divide-cream">
              {circle.map((member) => {
                const initials = (member.full_name || "?")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-3.5"
                  >
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-blush/20 flex items-center justify-center shrink-0">
                        <span className="font-serif text-sm text-espresso">{initials}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-medium text-espresso truncate">
                        {member.full_name || "Member"}
                      </p>
                      {member.city && (
                        <p className="font-sans text-[11px] text-taupe truncate">{member.city}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default SettingsCircle;
