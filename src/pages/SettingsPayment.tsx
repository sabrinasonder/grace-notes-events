import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, CreditCard } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

const SettingsPayment = () => {
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
            Payment Methods
          </h1>
          <div className="h-10 w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6 mt-16 flex flex-col items-center text-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-cream flex items-center justify-center">
          <CreditCard className="h-6 w-6 text-taupe" strokeWidth={1.5} />
        </div>
        <p className="font-serif italic text-lg text-taupe">Coming soon</p>
        <p className="font-sans text-[12px] text-taupe max-w-xs leading-relaxed">
          Saved payment methods and billing history will be available here. For now, payments are processed securely through Stripe at checkout.
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default SettingsPayment;
