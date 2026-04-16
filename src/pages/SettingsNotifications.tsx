import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Bell, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";

const SettingsNotifications = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone_verified")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: prefs } = useQuery({
    queryKey: ["notification_prefs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (
        data || {
          email_reminders: true,
          sms_reminders: true,
          host_announcements_email: true,
          host_announcements_sms: true,
        }
      );
    },
    enabled: !!user,
  });

  const togglePref = async (field: string, value: boolean) => {
    if (!user) return;
    try {
      const { data: existing } = await supabase
        .from("notification_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("notification_preferences")
          .update({ [field]: value } as any)
          .eq("user_id", user.id);
      } else {
        await supabase.from("notification_preferences").insert({
          user_id: user.id,
          email_reminders: true,
          sms_reminders: true,
          host_announcements_email: true,
          host_announcements_sms: true,
          ...({ [field]: value } as any),
        } as any);
      }
      queryClient.invalidateQueries({ queryKey: ["notification_prefs", user.id] });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
  };

  if (authLoading) return null;
  if (!user) { navigate("/join"); return null; }

  const smsDisabled = !profile?.phone_verified;

  const toggles = [
    {
      field: "email_reminders",
      label: "Email reminders",
      description: "48h and morning-of reminders for events you're attending",
      icon: Bell,
      disabled: false,
      checked: prefs?.email_reminders ?? true,
    },
    {
      field: "sms_reminders",
      label: "SMS reminders",
      description: smsDisabled ? "Verify your phone number in Account to enable" : "Text reminders before events",
      icon: Phone,
      disabled: smsDisabled,
      checked: prefs?.sms_reminders ?? true,
    },
    {
      field: "host_announcements_email",
      label: "Host updates (email)",
      description: "When a host posts an announcement for your event",
      icon: Bell,
      disabled: false,
      checked: prefs?.host_announcements_email ?? true,
    },
    {
      field: "host_announcements_sms",
      label: "Host updates (SMS)",
      description: smsDisabled ? "Verify your phone number in Account to enable" : "Text when hosts post updates",
      icon: Phone,
      disabled: smsDisabled,
      checked: prefs?.host_announcements_sms ?? true,
    },
  ];

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
            Notifications
          </h1>
          <div className="h-10 w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6 mt-6">
        <div className="rounded-2xl border border-cream bg-paper divide-y divide-cream">
          {toggles.map(({ field, label, description, icon: Icon, disabled, checked }) => (
            <div
              key={field}
              className={cn("flex items-center gap-3 px-4 py-4", disabled && "opacity-50")}
            >
              <Icon className="h-4 w-4 text-taupe shrink-0" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-medium text-espresso">{label}</p>
                <p className="font-sans text-[11px] text-taupe leading-relaxed">{description}</p>
              </div>
              <button
                onClick={() => !disabled && togglePref(field, !checked)}
                disabled={disabled}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors shrink-0",
                  checked ? "bg-cocoa" : "bg-cream"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-all",
                    checked ? "left-[22px]" : "left-0.5"
                  )}
                />
              </button>
            </div>
          ))}
        </div>

        {smsDisabled && (
          <p className="mt-4 font-sans text-[11px] text-taupe text-center">
            Go to <button onClick={() => navigate("/settings/account")} className="underline underline-offset-2 text-cocoa">Account</button> to verify your phone and unlock SMS notifications.
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default SettingsNotifications;
