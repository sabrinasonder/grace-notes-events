import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useNotifications, type AppNotification } from "@/hooks/use-notifications";
import { BottomNav } from "@/components/BottomNav";
import {
  ArrowLeft,
  Bell,
  Calendar,
  CreditCard,
  UserPlus,
  Users,
  ShieldCheck,
  Sparkles,
  X,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow, isToday, isThisWeek } from "date-fns";

const TYPE_META: Record<
  string,
  { icon: React.ComponentType<any>; color: string; bg: string }
> = {
  event_invite:       { icon: UserPlus,    color: "text-cocoa",  bg: "bg-cream" },
  payment_reminder:   { icon: CreditCard,  color: "text-blush",  bg: "bg-blush/10" },
  event_update:       { icon: Calendar,    color: "text-sage",   bg: "bg-sage/10" },
  membership_request: { icon: Users,       color: "text-taupe",  bg: "bg-cream" },
  membership_approved:{ icon: ShieldCheck, color: "text-cocoa",  bg: "bg-cream" },
  welcome:            { icon: Sparkles,    color: "text-blush",  bg: "bg-blush/10" },
};

function relativeTime(ts: string) {
  return formatDistanceToNow(new Date(ts), { addSuffix: true });
}

function groupByDate(notifications: AppNotification[]) {
  const today: AppNotification[] = [];
  const thisWeek: AppNotification[] = [];
  const earlier: AppNotification[] = [];
  for (const n of notifications) {
    const d = new Date(n.created_at);
    if (isToday(d)) today.push(n);
    else if (isThisWeek(d, { weekStartsOn: 1 })) thisWeek.push(n);
    else earlier.push(n);
  }
  return { today, thisWeek, earlier };
}

const NotificationItem = ({
  n,
  onTap,
  onDismiss,
}: {
  n: AppNotification;
  onTap: () => void;
  onDismiss: () => void;
}) => {
  const meta = TYPE_META[n.type] ?? TYPE_META.event_invite;
  const Icon = meta.icon;

  return (
    <div
      className={`relative flex items-start gap-3.5 rounded-2xl px-4 py-3.5 transition-colors ${
        n.is_read ? "bg-transparent" : "bg-cream/50"
      }`}
    >
      {/* Icon */}
      <div
        className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${meta.bg}`}
      >
        <Icon className={`h-4 w-4 ${meta.color}`} strokeWidth={1.5} />
      </div>

      {/* Content */}
      <button
        onClick={onTap}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-sans text-[13px] font-semibold text-espresso leading-snug">
            {n.title}
          </p>
          {!n.is_read && (
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blush" />
          )}
        </div>
        <p className="font-sans text-[12px] text-taupe leading-relaxed line-clamp-2">
          {n.body}
        </p>
        <p className="mt-1 font-sans text-[10px] text-taupe/60 uppercase tracking-[0.15em]">
          {relativeTime(n.created_at)}
        </p>
      </button>

      {/* Navigate arrow */}
      {n.action_url && (
        <ChevronRight className="mt-2 h-4 w-4 flex-shrink-0 text-taupe/40" strokeWidth={1.5} />
      )}

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-cream/80 hover:bg-cream transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3 text-taupe" strokeWidth={2} />
      </button>
    </div>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <p className="px-4 mb-1 font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe/60">
    {title}
  </p>
);

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markRead, dismiss, markAllRead } =
    useNotifications();

  const handleTap = (n: AppNotification) => {
    if (!n.is_read) markRead(n.id);
    if (n.action_url) navigate(n.action_url);
  };

  const { today, thisWeek, earlier } = groupByDate(notifications);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-cream px-5 py-4">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-cream transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>

          <h1 className="font-serif text-[18px] text-espresso">Notifications</h1>

          {unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-taupe hover:text-cocoa transition-colors"
            >
              Mark all read
            </button>
          ) : (
            <div className="w-16" /> /* spacer */
          )}
        </div>
      </div>

      <div className="mx-auto max-w-lg px-2 pt-3 space-y-1">
        {isLoading ? (
          <div className="space-y-2 px-4 pt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-cream" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center px-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream mb-5">
              <Bell className="h-7 w-7 text-taupe" strokeWidth={1.5} />
            </div>
            <h2 className="font-serif text-xl text-espresso mb-2">All caught up</h2>
            <p className="font-serif italic text-sm text-taupe">
              No new notifications right now.
            </p>
          </div>
        ) : (
          <>
            {today.length > 0 && (
              <div>
                <SectionHeader title="Today" />
                {today.map((n) => (
                  <NotificationItem
                    key={n.id}
                    n={n}
                    onTap={() => handleTap(n)}
                    onDismiss={() => dismiss(n.id)}
                  />
                ))}
              </div>
            )}

            {thisWeek.length > 0 && (
              <div className={today.length > 0 ? "pt-4" : ""}>
                <SectionHeader title="This Week" />
                {thisWeek.map((n) => (
                  <NotificationItem
                    key={n.id}
                    n={n}
                    onTap={() => handleTap(n)}
                    onDismiss={() => dismiss(n.id)}
                  />
                ))}
              </div>
            )}

            {earlier.length > 0 && (
              <div className={today.length > 0 || thisWeek.length > 0 ? "pt-4" : ""}>
                <SectionHeader title="Earlier" />
                {earlier.map((n) => (
                  <NotificationItem
                    key={n.id}
                    n={n}
                    onTap={() => handleTap(n)}
                    onDismiss={() => dismiss(n.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Notifications;
