import { useNavigate, useLocation } from "react-router-dom";
import { Home, Plus, User } from "lucide-react";

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isSettings = location.pathname === "/settings";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-cream bg-background">
      <div className="mx-auto flex max-w-lg items-center justify-around px-6 py-3" style={{ height: 70 }}>
        <button onClick={() => navigate("/")} className="flex flex-col items-center gap-1">
          <Home className={`h-[22px] w-[22px] ${isHome ? "text-cocoa" : "text-taupe"}`} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => navigate("/create")}
          className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-cocoa shadow-lg transition-transform active:scale-95"
        >
          <Plus className="h-5 w-5 text-background" strokeWidth={2} />
        </button>
        <button onClick={() => navigate("/settings")} className="flex flex-col items-center gap-1">
          <User className={`h-[22px] w-[22px] ${isSettings ? "text-cocoa" : "text-taupe"}`} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
