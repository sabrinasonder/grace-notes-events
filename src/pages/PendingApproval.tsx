/**
 * /pending — shown to users whose membership_request status is 'pending'
 *
 * Auto-refreshes every 30 s so it clears as soon as an admin approves them.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Clock } from "lucide-react";

const PendingApproval = () => {
  const { user, loading, membershipStatus, refreshMembership, signOut } = useAuth();
  const navigate = useNavigate();

  // Redirect away once approved
  useEffect(() => {
    if (!loading && membershipStatus === "approved") {
      navigate("/", { replace: true });
    }
    if (!loading && !user) {
      navigate("/join", { replace: true });
    }
  }, [loading, membershipStatus, user, navigate]);

  // Poll every 30 s
  useEffect(() => {
    const id = setInterval(() => {
      refreshMembership?.();
    }, 30_000);
    return () => clearInterval(id);
  }, [refreshMembership]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-cream">
        <Clock className="h-7 w-7 text-cocoa" strokeWidth={1.5} />
      </div>

      <h1 className="font-serif text-[28px] leading-tight text-espresso mb-3">
        You're on the list
      </h1>
      <p className="font-sans text-[14px] text-taupe leading-relaxed max-w-xs mb-10">
        Your request to join Sonder Circle is being reviewed. You'll receive an
        email as soon as you're approved.
      </p>

      <button
        onClick={() => refreshMembership?.()}
        className="mb-4 rounded-full border border-cream px-6 py-2.5 font-sans text-[12px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cream"
      >
        Check again
      </button>

      <button
        onClick={async () => {
          await signOut();
          navigate("/join", { replace: true });
        }}
        className="font-sans text-[11px] text-taupe underline underline-offset-2"
      >
        Sign out
      </button>
    </div>
  );
};

export default PendingApproval;
