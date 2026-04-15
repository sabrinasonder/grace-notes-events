import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import heroImage from "@/assets/welcome-hero.jpg";

const Welcome = () => {
  const { user, loading, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-display text-2xl text-foreground">Sonder Circle</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { error } = await signInWithMagicLink(email);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero image section */}
      <div className="relative h-[55vh] w-full overflow-hidden">
        <img
          src={heroImage}
          alt="Women gathered together"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>

      {/* Content section */}
      <div className="flex flex-1 flex-col items-center px-6 pb-12 -mt-8 relative z-10">
        <div className="w-full max-w-sm space-y-8">
          {/* Branding */}
          <div className="space-y-3 text-center">
            <p className="label-meta text-muted-foreground">A Private Community</p>
            <h1 className="font-display text-4xl font-normal tracking-tight text-foreground">
              Sonder Circle
            </h1>
            <p className="font-body text-base text-muted-foreground leading-relaxed">
              Intimate gatherings, <em className="font-display italic">beautifully</em> organized.
            </p>
          </div>

          {sent ? (
            /* Success state */
            <div className="animate-fade-in space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <svg className="h-7 w-7 text-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl text-foreground">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a magic link to <span className="font-semibold text-foreground">{email}</span>
                </p>
              </div>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="label-meta text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            /* Login form */
            <form onSubmit={handleSubmit} className="animate-fade-in space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="label-meta text-muted-foreground">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-full border border-border bg-background px-5 py-3.5 font-body text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-primary py-3.5 transition-all hover:opacity-90 disabled:opacity-50"
              >
                <span className="label-meta text-primary-foreground">
                  {submitting ? "Sending…" : "Continue with Magic Link"}
                </span>
              </button>

              <p className="text-center text-xs text-muted-foreground/70 leading-relaxed">
                No password needed — we'll email you a secure link to sign in.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Welcome;
