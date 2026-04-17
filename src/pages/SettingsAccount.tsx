import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, Loader2, Phone, Shield, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";

const SettingsAccount = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [phone, setPhone] = useState("");
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [verifyStep, setVerifyStep] = useState<"idle" | "sent" | "verifying">("idle");
  const [verificationCode, setVerificationCode] = useState("");

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

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (profile?.phone) setPhone(profile.phone);
  }, [profile]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Please choose an image under 5 MB.", variant: "destructive" });
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) {
        if (uploadError.message?.toLowerCase().includes("bucket")) {
          throw new Error("Storage not set up yet — run migration 20260416110000 in Supabase SQL Editor first.");
        }
        throw uploadError;
      }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // Bust the CDN cache by appending a timestamp
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast({ title: "Photo updated!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
    const cleaned = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
    if (!/^\+[1-9]\d{1,14}$/.test(cleaned)) {
      toast({
        title: "Invalid phone number",
        description: "Use format: +15551234567",
        variant: "destructive",
      });
      return;
    }
    setPhone(cleaned);
    setIsSavingPhone(true);
    try {
      const { error, data } = await supabase.functions.invoke(
        "send-phone-verification",
        { body: { phone: cleaned } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setVerifyStep("sent");
      toast({ title: "Code sent", description: `We sent a code to ${cleaned}` });
    } catch (err: any) {
      toast({
        title: "Failed to send code",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) return;
    setVerifyStep("verifying");
    try {
      const { error, data } = await supabase.functions.invoke("verify-phone-code", {
        body: { phone, code: verificationCode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
      setVerifyStep("idle");
      setVerificationCode("");
      toast({ title: "Phone verified!" });
    } catch (err: any) {
      toast({ title: "Incorrect code", description: err.message, variant: "destructive" });
      setVerifyStep("sent");
    }
  };

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
          <h1 className="flex-1 text-center font-serif text-lg text-espresso">Account</h1>
          <div className="h-10 w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6 mt-8 space-y-8">
        {/* Profile photo */}
        <div className="flex flex-col items-center gap-4 pb-2">
          <div className="relative">
            {/* Avatar */}
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="h-24 w-24 rounded-full object-cover border-2 border-cream"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-blush/20 border-2 border-cream flex items-center justify-center font-serif text-3xl text-espresso">
                {(profile?.full_name || user?.email || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}
              </div>
            )}
            {/* Camera overlay button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-espresso border-2 border-background shadow transition-opacity hover:opacity-80 disabled:opacity-50"
              aria-label="Change photo"
            >
              {isUploadingPhoto ? (
                <Loader2 className="h-3.5 w-3.5 text-background animate-spin" strokeWidth={2} />
              ) : (
                <Camera className="h-3.5 w-3.5 text-background" strokeWidth={2} />
              )}
            </button>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe hover:text-cocoa transition-colors disabled:opacity-40"
          >
            {isUploadingPhoto ? "Uploading…" : profile?.avatar_url ? "Change photo" : "Add photo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
            Email
          </p>
          <div className="rounded-xl border border-cream bg-paper px-4 py-3.5">
            <p className="font-sans text-sm text-cocoa">{user.email}</p>
          </div>
        </div>

        {/* Display name */}
        <div className="space-y-2">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
            Display name
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="flex-1 rounded-xl border border-cream bg-paper px-4 py-3 text-sm font-sans text-espresso placeholder:text-taupe focus:outline-none focus:ring-1 focus:ring-cocoa transition-colors"
            />
            <button
              onClick={handleSaveName}
              disabled={!fullName.trim() || fullName === profile?.full_name || isSavingName}
              className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-cocoa transition-all hover:opacity-90 disabled:opacity-40"
            >
              {isSavingName ? (
                <Loader2 className="h-4 w-4 text-background animate-spin" />
              ) : (
                <Check className="h-4 w-4 text-background" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
            Phone number
          </p>
          <p className="font-sans text-[11px] text-taupe leading-relaxed">
            Add your number for SMS reminders. We'll never text you about anything else.
          </p>

          {profile?.phone_verified ? (
            <div className="flex items-center gap-2 rounded-xl bg-sage/10 border border-sage/20 px-4 py-3">
              <Check className="h-4 w-4 text-sage shrink-0" strokeWidth={1.5} />
              <span className="flex-1 text-sm font-sans text-espresso">{profile.phone}</span>
              <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-sage">
                Verified
              </span>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+15551234567"
                  className="flex-1 rounded-xl border border-cream bg-paper px-4 py-3 text-sm font-sans text-espresso placeholder:text-taupe focus:outline-none focus:ring-1 focus:ring-cocoa transition-colors"
                />
                <button
                  onClick={handleSendVerification}
                  disabled={!phone.trim() || isSavingPhone}
                  className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-cocoa transition-all hover:opacity-90 disabled:opacity-40"
                >
                  {isSavingPhone ? (
                    <Loader2 className="h-4 w-4 text-background animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4 text-background" strokeWidth={1.5} />
                  )}
                </button>
              </div>
              {verifyStep === "sent" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="flex-1 rounded-xl border border-cream bg-paper px-4 py-3 text-sm font-sans text-espresso text-center tracking-widest placeholder:tracking-normal placeholder:text-taupe focus:outline-none focus:ring-1 focus:ring-cocoa"
                  />
                  <button
                    onClick={handleVerifyCode}
                    disabled={verificationCode.length < 4}
                    className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-cocoa transition-all hover:opacity-90 disabled:opacity-40"
                  >
                    <Shield className="h-4 w-4 text-background" strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default SettingsAccount;
