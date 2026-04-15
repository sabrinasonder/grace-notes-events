import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";

const Index = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-display text-2xl text-foreground">Sonder Circle</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <div className="min-h-screen bg-background px-5 pb-24 pt-12">
      <div className="mx-auto max-w-lg space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <p className="label-meta text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl text-foreground">Sonder Circle</h1>
        </div>

        {/* Placeholder for event feed — coming in Step 2 */}
        <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <svg className="h-6 w-6 text-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-xl text-foreground">No upcoming events</h2>
            <p className="text-sm text-muted-foreground">
              Your event feed will appear here. Check back soon or create an event.
            </p>
          </div>
        </div>

        {/* Signed in as */}
        <div className="rounded-3xl border border-border bg-card p-5 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="label-meta text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium text-foreground">{user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="pill-tag border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
