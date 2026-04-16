import { useNavigate, useLocation } from "react-router-dom";
import { Home, Plus, User, Heart, UserPlus } from "lucide-react";

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isHearted = location.pathname === "/hearted";
  const isInvite = location.pathname === "/invite";
  const isSettings = location.pathname === "/settings" || location.pathname.startsWith("/settings/");

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-cream bg-background">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-3" style={{ height: 70 }}>
        <button onClick={() => navigate("/")} className="flex flex-col items-center gap-1 px-3">
          <Home className={`h-[22px] w-[22px] ${isHome ? "text-cocoa" : "text-taupe"}`} strokeWidth={1.5} />
        </button>
        <button onClick={() => navigate("/invite")} className="flex flex-col items-center gap-1 px-3">
          <UserPlus className={`h-[22px] w-[22px] ${isInvite ? "text-cocoa" : "text-taupe"}`} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => navigate("/create")}
          className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-cocoa shadow-lg transition-transform active:scale-95 shrink-0"
        >
          <Plus className="h-5 w-5 text-background" strokeWidth={2} />
        </button>
        <button onClick={() => navigate("/hearted")} className="flex flex-col items-center gap-1 px-3">
          <Heart className={`h-[22px] w-[22px] ${isHearted ? "text-cocoa" : "text-taupe"}`} strokeWidth={1.5} />
        </button>
        <button onClick={() => navigate("/settings")} className="flex flex-col items-center gap-1 px-3">
          <User className={`h-[22px] w-[22px] ${isSettings ? "text-cocoa" : "text-taupe"}`} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
