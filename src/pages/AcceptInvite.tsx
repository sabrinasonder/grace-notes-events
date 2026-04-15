import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import heroImage from "@/assets/welcome-hero.jpg";

type InviteState = "loading" | "valid" | "expired" | "invalid" | "accepted" | "signing_up";

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { user, loading: authLoading, signInWithMagicLink } = useAuth();

  const [state, setState] = useState<InviteState>("loading");
  const [invite, setInvite] = useState<any>(null);
  const [inviterName, setInviterName] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // If user is already logged in, redirect to home
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Validate the invite token
  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }

    const validateToken = async () => {
      // Use edge function to validate token (service role needed to read invites)
      const { data, error } = await supabase.functions.invoke("validate-invite", {
        body: { token },
      });

      if (error || !data?.valid) {
        setState(data?.reason === "expired" ? "expired" : "invalid");
        return;
      }

      setInvite(data.invite);
      setInviterName(data.inviterName || "A friend");
      setFullName(data.invite.invitee_name || "");
      setEmail(data.invite.invitee_email || "");
      setState("valid");
    };

    validateToken();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) return;

    setState("signing_up");

    // Send magic link for the invitee's email
    const { error: authError } = await signInWithMagicLink(email.trim());

    if (authError) {
      setError(authError.message);
      setState("valid");
      return;
    }

    // Mark invite as accepted via edge function
    await supabase.functions.invoke("accept-invite", {
      body: {
        token,
        fullName: fullName.trim(),
        city: city.trim() || null,
      },
    });

    setMagicLinkSent(true);
    setState("accepted");
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero image */}
      <div className="relative h-[40vh] w-full overflow-hidden">
        <img src={heroImage} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center px-6 pb-12 -mt-8 relative z-10">
        <div className="w-full max-w-sm space-y-8">
          {state === "loading" && (
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Checking your invitation…</p>
            </div>
          )}

          {state === "invalid" && (
            <div className="text-center space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" strokeWidth={1} />
              <h1 className="font-display text-2xl text-foreground">Invalid Invitation</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This invite link isn't valid. If you believe this is an error, ask the person who invited you to resend.
              </p>
              <button
                onClick={() => navigate("/welcome")}
                className="label-meta text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                I already have an account
              </button>
            </div>
          )}

          {state === "expired" && (
            <div className="text-center space-y-4">
              <XCircle className="h-12 w-12 text-muted-foreground mx-auto" strokeWidth={1} />
              <h1 className="font-display text-2xl text-foreground">Invitation Expired</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This invitation has expired. Ask your friend to send a new one — invitations are valid for 14 days.
              </p>
              <button
                onClick={() => navigate("/welcome")}
                className="label-meta text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                I already have an account
              </button>
            </div>
          )}

          {(state === "valid" || state === "signing_up") && (
            <>
              <div className="space-y-3 text-center">
                <p className="label-meta text-muted-foreground">You're Invited</p>
                <h1 className="font-display text-3xl text-foreground">
                  Welcome to<br />Sonder Circle
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {inviterName} invited you to join a private community for women.
                </p>
                {invite?.personal_note && (
                  <div className="rounded-2xl border border-border bg-card p-4 mt-4">
                    <p className="text-sm text-foreground italic font-display leading-relaxed">
                      "{invite.personal_note}"
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">— {inviterName}</p>
                  </div>
                )}
              </div>

              <form onSubmit={handleAccept} className="space-y-4">
                <div className="space-y-2">
                  <label className="label-meta text-muted-foreground">Your Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-full border border-border bg-background px-5 py-3.5 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="label-meta text-muted-foreground">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    className="w-full rounded-full border border-border bg-background px-5 py-3.5 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="label-meta text-muted-foreground">City (Optional)</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Where are you based?"
                    maxLength={100}
                    className="w-full rounded-full border border-border bg-background px-5 py-3.5 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={state === "signing_up"}
                  className="w-full rounded-full bg-primary py-3.5 transition-all hover:opacity-90 disabled:opacity-50"
                >
                  <span className="label-meta text-primary-foreground">
                    {state === "signing_up" ? "Setting up…" : "Accept Invitation"}
                  </span>
                </button>
              </form>
            </>
          )}

          {state === "accepted" && (
            <div className="animate-fade-in text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-sage mx-auto" strokeWidth={1} />
              <h1 className="font-display text-2xl text-foreground">Check Your Email</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We sent a magic link to <span className="font-semibold text-foreground">{email}</span>.
                Tap it to finish joining Sonder Circle.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
