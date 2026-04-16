import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Mail, MessageSquare, ExternalLink } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

const FAQ = [
  {
    q: "How do I create an event?",
    a: "Tap the + button at the bottom of the home screen. Fill in your event details and choose your privacy setting.",
  },
  {
    q: "How do I invite someone?",
    a: "Open your event, go to the Guests tab, and use the Invite Members button. They'll receive an email invitation.",
  },
  {
    q: "Can I cancel an event?",
    a: "Yes. Open your event, tap the ··· menu in the top right, and select Cancel event. All guests will be notified and any payments refunded.",
  },
  {
    q: "How do refunds work?",
    a: "When a paid event is cancelled, all guests who paid are automatically refunded through Stripe within 5–10 business days.",
  },
  {
    q: "How do I update my phone number?",
    a: "Go to Settings → Account → Phone number. Enter your new number and verify it with the code we send.",
  },
];

const SettingsHelp = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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
            Help & Feedback
          </h1>
          <div className="h-10 w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6 mt-8 space-y-10">
        {/* Contact section */}
        <div className="space-y-3">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
            Get in touch
          </p>
          <div className="rounded-2xl border border-cream bg-paper divide-y divide-cream overflow-hidden">
            <a
              href="mailto:hello@sondercircle.com"
              className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-cream"
            >
              <Mail className="h-4 w-4 text-taupe shrink-0" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="font-sans text-sm text-espresso">Email us</p>
                <p className="font-sans text-[11px] text-taupe">hello@sondercircle.com</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-taupe" strokeWidth={1.5} />
            </a>
            <a
              href="sms:+1"
              className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-cream"
            >
              <MessageSquare className="h-4 w-4 text-taupe shrink-0" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="font-sans text-sm text-espresso">Send feedback</p>
                <p className="font-sans text-[11px] text-taupe">We read every message</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-taupe" strokeWidth={1.5} />
            </a>
          </div>
        </div>

        {/* FAQ section */}
        <div className="space-y-3">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
            Frequently asked
          </p>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <div
                key={q}
                className="rounded-2xl border border-cream bg-paper px-4 py-4 space-y-1.5"
              >
                <p className="font-sans text-sm font-semibold text-espresso">{q}</p>
                <p className="font-sans text-[12px] text-taupe leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default SettingsHelp;
