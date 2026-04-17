/**
 * /join          — public landing + auth page (replaces /welcome)
 * /join/:inviteCode — personalised invite landing + auth
 *
 * No auth required. Handles the full unauthenticated journey:
 *   landing → email entry → 6-digit code entry → signed in.
 *
 * Using OTP codes instead of magic links means the user stays in the same
 * browser/tab they started in — no new windows, no default-browser detours.
 */
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft } from "lucide-react";

type View = "landing" | "signin" | "verify";

const Diamond = () => (
  <span aria-hidden className="text-blush" style={{ fontSize: 10, letterSpacing: 0 }}>
    ✦
  </span>
);

const JoinPage = () => {
  const { inviteCode } = useParams<{ inviteCode?: string }>();
  const { user, loading: authLoading, signInWithMagicLink, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const [view, setView] = useState<View>("landing");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Dev login (password-based, hidden behind 5-tap on footer)
  const [devTaps, setDevTaps] = useState(0);
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [devPassword, setDevPassword] = useState("");

  // Persist invite code for post-signup processing in auth.tsx
  useEffect(() => {
    if (inviteCode) localStorage.setItem("sonder_invite_code", inviteCode);
  }, [inviteCode]);

  // Persist redirect path so it survives any session round-trip
  useEffect(() => {
    if (redirectPath !== "/") {
      localStorage.setItem("sonder_redirect_after_auth", redirectPath);
      if (redirectPath.includes("/event/")) {
        localStorage.setItem("sonder_via_event_link", "true");
      }
    }
  }, [redirectPath]);

  // Signed-in users go to the redirect destination (or home)
  useEffect(() => {
    if (!authLoading && user) {
      const dest = localStorage.getItem("sonder_redirect_after_auth") || redirectPath;
      localStorage.removeItem("sonder_redirect_after_auth");
      navigate(dest, { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Auto-focus the code input when the verify view appears
  useEffect(() => {
    if (view === "verify") {
      const t = setTimeout(() => codeInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [view]);

  // Look up inviter details when a code is present
  const { data: inviteData } = useQuery({
    queryKey: ["invite_lookup", inviteCode],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("invites")
        .select("invitee_name, personal_note, inviter:inviter_id(full_name), status, expires_at")
        .eq("token", inviteCode!)
        .maybeSingle();
      return data as {
        invitee_name: string | null;
        personal_note: string | null;
        inviter: { full_name: string } | null;
        status: string;
        expires_at: string;
      } | null;
    },
    enabled: !!inviteCode,
  });

  const isExpired = inviteData?.expires_at
    ? new Date(inviteData.expires_at) < new Date()
    : false;
  const inviterName = inviteData?.inviter?.full_name ?? null;
  const inviteeName = inviteData?.invitee_name ?? null;
  const personalNote = inviteData?.personal_note ?? null;

  // Step 1 — send the 6-digit code to the user's email
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setSubmitting(true);
    // Still pass emailRedirectTo so the link in the email (if clicked) also works
    const emailRedirectTo = redirectPath !== "/"
      ? `${window.location.origin}/join?redirect=${encodeURIComponent(redirectPath)}`
      : window.location.origin;
    const { error: err } = await signInWithMagicLink(email.trim(), { emailRedirectTo });
    setSubmitting(false);
    if (err) {
      setError(err.message);
    } else {
      setCode("");
      setView("verify");
    }
  };

  // Step 2 — verify the code the user typed
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.replace(/\s/g, "");
    if (trimmed.length < 6) return;
    setError("");
    setSubmitting(true);
    const { error: err } = await verifyOtp(email.trim(), trimmed);
    setSubmitting(false);
    if (err) {
      setError("That code didn't work. Check it and try again, or request a new one.");
    }
    // On success, the auth listener in auth.tsx fires and the useEffect above navigates the user
  };

  // Resend the code
  const handleResend = async () => {
    setResending(true);
    setError("");
    setCode("");
    const emailRedirectTo = redirectPath !== "/"
      ? `${window.location.origin}/join?redirect=${encodeURIComponent(redirectPath)}`
      : window.location.origin;
    await signInWithMagicLink(email.trim(), { emailRedirectTo });
    setResending(false);
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: devPassword,
    });
    if (err) setError(err.message);
  };

  const handleFooterTap = () => {
    const next = devTaps + 1;
    setDevTaps(next);
    if (next >= 5) {
      setShowDevLogin(true);
      setDevTaps(0);
    }
  };

  if (authLoading) return null;

  // ── Step 2: Enter the 6-digit code ───────────────────────────────────────
  if (view === "verify") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-8" style={{ minHeight: "100svh" }}>
        <div className="w-full max-w-xs">
          <button
            onClick={() => { setView("signin"); setError(""); setCode(""); }}
            className="flex items-center gap-1.5 font-sans text-[11px] text-taupe mb-10 -ml-0.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Back
          </button>

          <h2 className="font-serif text-[26px] text-espresso mb-1.5">Check your email</h2>
          <p className="font-sans text-[13px] text-taupe mb-8 leading-snug">
            We sent a 6-digit code to{" "}
            <span className="text-espresso font-medium">{email}</span>.
            Enter it below to sign in.
          </p>

          <form onSubmit={handleVerifyCode} className="space-y-4">
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                // Only allow digits
                setCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              placeholder="000000"
              className="w-full bg-transparent border-b border-cream pb-2.5 font-serif text-[32px] text-center tracking-[0.35em] text-espresso placeholder:text-taupe/30 focus:outline-none focus:border-cocoa transition-colors"
            />
            {error && (
              <p className="font-sans text-[11px] text-destructive text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting || code.replace(/\s/g, "").length < 6}
              className="mt-2 flex w-full items-center justify-center rounded-full bg-espresso py-4 font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-background transition-opacity disabled:opacity-40"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                : "Verify"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={handleResend}
              disabled={resending}
              className="font-sans text-[11px] text-taupe underline underline-offset-2 disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Sign-in form ──────────────────────────────────────────────────
  if (view === "signin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-8" style={{ minHeight: "100svh" }}>
        <div className="w-full max-w-xs">
          <button
            onClick={() => { setView("landing"); setError(""); }}
            className="flex items-center gap-1.5 font-sans text-[11px] text-taupe mb-10 -ml-0.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Back
          </button>

          <h2 className="font-serif text-[26px] text-espresso mb-1.5">
            {inviteCode ? "Accept your invitation" : "Continue"}
          </h2>
          <p className="font-sans text-[13px] text-taupe mb-8 leading-snug">
            Enter your email — we'll send you a 6-digit code to sign in.
          </p>

          <form onSubmit={handleSendCode} className="space-y-4">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-transparent border-b border-cream pb-2.5 font-sans text-[15px] text-espresso placeholder:text-taupe/40 focus:outline-none focus:border-cocoa transition-colors"
            />
            {error && (
              <p className="font-sans text-[11px] text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="mt-2 flex w-full items-center justify-center rounded-full bg-espresso py-4 font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-background transition-opacity disabled:opacity-40"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                : "Send code"}
            </button>
          </form>

          {showDevLogin && (
            <form onSubmit={handleDevLogin} className="mt-6 space-y-3 border-t border-cream pt-6">
              <p className="font-sans text-[10px] text-taupe/50 uppercase tracking-widest mb-2">Dev login</p>
              <input
                type="password"
                value={devPassword}
                onChange={(e) => setDevPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-transparent border-b border-cream pb-2 font-sans text-sm text-espresso placeholder:text-taupe/40 focus:outline-none"
              />
              <button
                type="submit"
                className="font-sans text-[11px] text-taupe underline underline-offset-2"
              >
                Sign in with password
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Landing view ──────────────────────────────────────────────────────────
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-between px-8 py-12 bg-background"
      style={{ minHeight: "100svh" }}
    >
      {/* Main content — vertically centered */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-xs text-center gap-0">

        {/* 1. Name */}
        <h1
          className="font-serif text-espresso"
          style={{ fontSize: "clamp(2.4rem, 8vw, 3rem)", lineHeight: 1.05, letterSpacing: "-0.01em" }}
        >
          Sonder Circle
        </h1>

        {/* 2. Tagline */}
        <p className="mt-3 font-sans text-[13px] text-taupe tracking-wide leading-snug">
          A private community for women who gather
        </p>

        {/* 3. Divider */}
        <div className="mt-7 mb-7 flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-cream" />
          <span className="text-[9px] text-taupe/50 tracking-[0.3em] font-sans uppercase">est. 2025</span>
          <div className="flex-1 h-px bg-cream" />
        </div>

        {/* 4. Feature highlights */}
        <ul className="flex flex-col items-center gap-3.5 w-full">
          {["Curated Events", "Intimate Community", "Effortless Planning"].map((label) => (
            <li key={label} className="flex items-center gap-2.5">
              <Diamond />
              <span className="font-sans text-[13px] text-cocoa tracking-[0.04em]">{label}</span>
            </li>
          ))}
        </ul>

        {/* 5. Invite block (code present only) */}
        {inviteCode && !isExpired && (
          <div className="mt-10 w-full space-y-2">
            {inviterName ? (
              <p className="font-serif text-[17px] text-espresso leading-snug">
                {inviteeName && <><span className="font-semibold">{inviteeName}</span>, </>}
                You've been invited by{" "}
                <span className="font-semibold">{inviterName}</span>
              </p>
            ) : (
              <p className="font-serif text-[17px] text-espresso leading-snug">
                You've received an invitation to Sonder Circle.
              </p>
            )}
            {personalNote && (
              <p className="font-serif italic text-[14px] text-taupe leading-relaxed mt-3">
                &ldquo;{personalNote}&rdquo;
              </p>
            )}
          </div>
        )}

        {inviteCode && isExpired && (
          <p className="mt-10 font-sans text-[13px] text-taupe/60 italic">
            This invite link has expired.
          </p>
        )}

        {/* 6. CTAs */}
        <div className="mt-10 w-full space-y-4">
          {!isExpired && (
            <button
              onClick={() => setView("signin")}
              className="flex w-full items-center justify-center rounded-full bg-espresso py-4 font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-background transition-opacity active:opacity-80"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {inviteCode ? "Join Sonder Circle" : "Request Access"}
            </button>
          )}
          <button
            onClick={() => setView("signin")}
            className="block w-full font-sans text-[11px] text-taupe/70 leading-relaxed"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Already a member?{" "}
            <span className="text-cocoa underline underline-offset-2 decoration-cocoa/30">
              Sign in
            </span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <button
        onClick={handleFooterTap}
        className="mt-10 font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/40 cursor-default"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        By invitation only
      </button>
    </div>
  );
};

export default JoinPage;
