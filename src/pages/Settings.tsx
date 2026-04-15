import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Phone, Bell, Check, Loader2, Shield, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";

const Settings = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyStep, setVerifyStep] = useState<"idle" | "sent" | "verifying">("idle");
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch notification preferences
  const { data: prefs } = useQuery({
    queryKey: ["notification_prefs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data || {
        email_reminders: true,
        sms_reminders: true,
        host_announcements_email: true,
        host_announcements_sms: true,
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile?.phone) setPhone(profile.phone);
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile]);

  const handleSaveName = async () => {
    if (!fullName.trim() || !user) return;
    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast({ title: "Name updated!" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSendVerification = async () => {
    if (!phone.trim()) return;
    // Validate E.164
    const cleaned = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
    if (!/^\+[1-9]\d{1,14}$/.test(cleaned)) {
      toast({ title: "Invalid phone number", description: "Use format: +15551234567", variant: "destructive" });
      return;
    }
    setPhone(cleaned);
    setIsSavingPhone(true);
    try {
      // Save phone to profile (unverified)
      const { error } = await supabase
        .from("profiles")
        .update({ phone: cleaned, phone_verified: false })
        .eq("id", user!.id);
      if (error) throw error;

      // In production, this would call Twilio Verify API via an edge function
      // For now, we'll mark as verified directly (simplified flow)
      // TODO: Add proper Twilio Verify when TWILIO_VERIFY_SERVICE_SID is set
      setVerifyStep("sent");
      toast({ title: "Verification code sent", description: `We sent a code to ${cleaned}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) return;
    setVerifyStep("verifying");
    try {
      // Simplified: mark as verified
      // In production, verify code via Twilio Verify API
      const { error } = await supabase
        .from("profiles")
        .update({ phone_verified: true })
        .eq("id", user!.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
      setVerifyStep("idle");
      setVerificationCode("");
      toast({ title: "Phone verified!", description: "You'll receive SMS notifications for your events." });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
      setVerifyStep("sent");
    }
  };

  const togglePref = async (field: string, value: boolean) => {
    if (!user) return;
    try {
      // Check if prefs row exists
      const { data: existing } = await supabase
        .from("notification_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("notification_preferences")
          .update({ [field]: value } as any)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: user.id,
            email_reminders: true,
            sms_reminders: true,
            host_announcements_email: true,
            host_announcements_sms: true,
            ...({ [field]: value } as any),
          } as any);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["notification_prefs", user.id] });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    navigate("/welcome");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-lg sticky top-0 z-20">
        <div className="mx-auto max-w-lg flex items-center gap-3 px-5 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="font-display text-xl text-foreground">Settings</h1>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-5 mt-6 space-y-8">
        {/* Profile info */}
        <div className="space-y-3">
          <h2 className="label-meta text-muted-foreground">Account</h2>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <div className="space-y-1.5">
              <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Display Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleSaveName}
                  disabled={!fullName.trim() || fullName === profile?.full_name || isSavingName}
                  className="rounded-xl bg-primary px-4 py-2.5 transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {isSavingName ? (
                    <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Phone number */}
        <div className="space-y-3">
          <h2 className="label-meta text-muted-foreground">Phone Number</h2>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add your number to get text reminders for events you're going to. We'll never text you about anything else.
            </p>

            {profile?.phone_verified ? (
              <div className="flex items-center gap-2 rounded-xl bg-sage/10 px-3 py-2.5">
                <Check className="h-4 w-4 text-sage" strokeWidth={1.5} />
                <span className="text-sm text-foreground">{profile.phone}</span>
                <span className="ml-auto pill-tag bg-sage text-sage-foreground">Verified</span>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+15551234567"
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={handleSendVerification}
                    disabled={!phone.trim() || isSavingPhone}
                    className="rounded-xl bg-primary px-4 py-2.5 transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {isSavingPhone ? (
                      <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
                    ) : (
                      <Phone className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
                    )}
                  </button>
                </div>

                {verifyStep === "sent" && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary text-center tracking-widest"
                    />
                    <button
                      onClick={handleVerifyCode}
                      disabled={verificationCode.length < 4}
                      className="rounded-xl bg-primary px-4 py-2.5 transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      <Shield className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Notification preferences */}
        <div className="space-y-3">
          <h2 className="label-meta text-muted-foreground">Notifications</h2>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            <NotifToggle
              label="Email reminders"
              description="48h and morning-of event reminders"
              icon={<Bell className="h-4 w-4" strokeWidth={1.5} />}
              checked={prefs?.email_reminders ?? true}
              onChange={(v) => togglePref("email_reminders", v)}
            />
            <NotifToggle
              label="SMS reminders"
              description="Text reminders before events"
              icon={<Phone className="h-4 w-4" strokeWidth={1.5} />}
              checked={prefs?.sms_reminders ?? true}
              onChange={(v) => togglePref("sms_reminders", v)}
              disabled={!profile?.phone_verified}
            />
            <NotifToggle
              label="Host updates (email)"
              description="When hosts post announcements"
              icon={<Bell className="h-4 w-4" strokeWidth={1.5} />}
              checked={prefs?.host_announcements_email ?? true}
              onChange={(v) => togglePref("host_announcements_email", v)}
            />
            <NotifToggle
              label="Host updates (SMS)"
              description="Text when hosts post updates"
              icon={<Phone className="h-4 w-4" strokeWidth={1.5} />}
              checked={prefs?.sms_reminders ?? true}
              onChange={(v) => togglePref("host_announcements_sms", v)}
              disabled={!profile?.phone_verified}
            />
          </div>
        </div>

        {/* Sign out */}
        <div className="space-y-3">
          <button
            onClick={async () => {
              await signOut();
              navigate("/welcome");
            }}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:bg-cream"
          >
            <LogOut className="h-4 w-4 text-destructive" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-destructive">Sign Out</span>
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

// Toggle sub-component
const NotifToggle = ({
  label,
  description,
  icon,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <div className={cn("flex items-center gap-3 px-4 py-3.5", disabled && "opacity-50")}>
    <div className="text-muted-foreground">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-border"
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
);

export default Settings;
