import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already_unsubscribed" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
        } else if (data.reason === "already_unsubscribed") {
          setStatus("already_unsubscribed");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("error");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (data?.success || data?.reason === "already_unsubscribed") {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="font-display text-2xl text-foreground">Sonder Circle</h1>
        <div className="h-px bg-border" />

        {status === "loading" && (
          <p className="text-muted-foreground">Verifying…</p>
        )}

        {status === "valid" && (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Would you like to unsubscribe from Sonder Circle emails?
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={submitting}
              className="w-full rounded-full bg-primary py-3.5 transition-all hover:opacity-90 disabled:opacity-50"
            >
              <span className="label-meta text-primary-foreground">
                {submitting ? "Processing…" : "Confirm Unsubscribe"}
              </span>
            </button>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-2">
            <p className="font-display text-xl text-foreground">You've been unsubscribed</p>
            <p className="text-sm text-muted-foreground">
              You won't receive any more emails from Sonder Circle.
            </p>
          </div>
        )}

        {status === "already_unsubscribed" && (
          <div className="space-y-2">
            <p className="font-display text-xl text-foreground">Already unsubscribed</p>
            <p className="text-sm text-muted-foreground">
              You've already been removed from our mailing list.
            </p>
          </div>
        )}

        {status === "invalid" && (
          <p className="text-sm text-destructive">
            This unsubscribe link is invalid or has expired.
          </p>
        )}

        {status === "error" && (
          <p className="text-sm text-destructive">
            Something went wrong. Please try again later.
          </p>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
