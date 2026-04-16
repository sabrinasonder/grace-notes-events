import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  Share2,
  Send,
  Check,
  Loader2,
  Link2,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";

const InviteFriend = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return null;
  if (!user) return <Navigate to="/join" replace />;
  return <InviteScreen user={user} />;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Sent", color: "text-taupe" },
  accepted: { label: "Joined", color: "text-sage" },
  revoked: { label: "Revoked", color: "text-destructive/50" },
  expired: { label: "Expired", color: "text-taupe/50" },
};

const InviteScreen = ({ user }: { user: any }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Generic share link (no specific recipient)
  const genericLink = `${window.location.origin}/join?ref=${user.id}`;

  const [copied, setCopied] = useState<string | null>(null); // stores which link was copied
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [latestToken, setLatestToken] = useState<string | null>(null);

  // Fetch user's sent invites
  const { data: invites = [], isLoading: invitesLoading } = useQuery({
    queryKey: ["my_invites", user.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invites")
        .select("id, invitee_name, invitee_email, token, status, created_at, expires_at")
        .eq("inviter_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast({ title: "Link copied!" });
      setTimeout(() => setCopied(null), 2500);
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const handleShare = async (url: string, recipientName?: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Sonder Circle",
          text: recipientName
            ? `Hi ${recipientName}, I'd love for you to join Sonder Circle — a private community for intimate gatherings.`
            : "I'd love for you to join Sonder Circle — a private community for intimate gatherings.",
          url,
        });
        return;
      } catch {}
    }
    handleCopy(url, recipientName ?? "generic");
  };

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invites")
        .insert({
          inviter_id: user.id,
          invitee_name: name.trim(),
          invitee_email: email.trim().toLowerCase(),
          personal_note: note.trim() || null,
        })
        .select("token")
        .single();
      if (error) throw error;
      return data as { token: string };
    },
    onSuccess: (data) => {
      setLatestToken(data.token);
      setName("");
      setEmail("");
      setNote("");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["my_invites", user.id] });
      toast({ title: "Invite created!", description: "Share the link below." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create invite", description: err.message, variant: "destructive" });
    },
  });

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    createInviteMutation.mutate();
  };

  const joinLinkFor = (token: string) => `${window.location.origin}/join/${token}`;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-cream bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-lg flex items-center px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cream transition-colors hover:bg-cream/80"
          >
            <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>
          <h1 className="flex-1 text-center font-serif text-lg text-espresso">
            Invite a Friend
          </h1>
          <div className="h-10 w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6 pt-8 space-y-8">
        {/* Intro */}
        <div className="text-center space-y-2">
          <p className="font-serif italic text-[17px] text-cocoa leading-relaxed">
            Sonder Circle grows through people who care.
          </p>
          <p className="font-sans text-[12px] text-taupe">
            Send a personal invite or share your link with the right person.
          </p>
        </div>

        {/* Latest generated link (shown after creating a new invite) */}
        {latestToken && (
          <div className="rounded-2xl border border-sage/30 bg-sage/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-sage/20">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-sage mb-1">
                Invite link ready
              </p>
              <p className="font-sans text-[12px] text-cocoa truncate select-all">
                {joinLinkFor(latestToken)}
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-sage/20">
              <button
                onClick={() => handleShare(joinLinkFor(latestToken))}
                className="flex items-center justify-center gap-2 px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-sage transition-colors hover:bg-sage/10"
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Share
              </button>
              <button
                onClick={() => handleCopy(joinLinkFor(latestToken), "latest")}
                className="flex items-center justify-center gap-2 px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-sage transition-colors hover:bg-sage/10"
              >
                {copied === "latest"
                  ? <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
                {copied === "latest" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* ── Create a personal invite ── */}
        <div className="space-y-3">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
            Personal invite
          </p>

          {/* Toggle form */}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-cream bg-paper px-4 py-3.5 font-sans text-[13px] text-cocoa transition-colors hover:bg-cream"
          >
            <span>Create a new invite link</span>
            {showForm
              ? <ChevronUp className="h-4 w-4 text-taupe" strokeWidth={1.5} />
              : <ChevronDown className="h-4 w-4 text-taupe" strokeWidth={1.5} />}
          </button>

          {showForm && (
            <form
              onSubmit={handleCreateInvite}
              className="rounded-2xl border border-cream bg-paper overflow-hidden"
            >
              <div className="px-4 py-3.5 border-b border-cream space-y-3">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Their name"
                  maxLength={100}
                  className="w-full bg-transparent font-serif text-[16px] text-espresso placeholder:text-taupe/40 focus:outline-none"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Their email"
                  maxLength={255}
                  className="w-full bg-transparent font-sans text-sm text-espresso placeholder:text-taupe/40 focus:outline-none"
                />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a personal note (optional)"
                  maxLength={500}
                  rows={2}
                  className="w-full bg-transparent font-sans text-sm text-espresso placeholder:text-taupe/40 focus:outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={createInviteMutation.isPending || !name.trim() || !email.trim()}
                className="flex w-full items-center justify-center gap-2 px-4 py-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cream disabled:opacity-40"
              >
                {createInviteMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  : <Send className="h-3.5 w-3.5" strokeWidth={1.5} />}
                {createInviteMutation.isPending ? "Creating…" : "Create Invite Link"}
              </button>
            </form>
          )}
        </div>

        {/* ── Invite history ── */}
        {(invites.length > 0 || invitesLoading) && (
          <div className="space-y-3">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
              Your invites · {invites.length}
            </p>
            <div className="rounded-2xl border border-cream bg-paper divide-y divide-cream overflow-hidden">
              {invitesLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-taupe" strokeWidth={1.5} />
                </div>
              ) : (
                invites.map((inv: any) => {
                  const statusInfo = STATUS_LABELS[inv.status] ?? { label: inv.status, color: "text-taupe" };
                  const date = new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const expired = new Date(inv.expires_at) < new Date() && inv.status === "pending";
                  const displayStatus = expired ? STATUS_LABELS.expired : statusInfo;
                  const link = joinLinkFor(inv.token);

                  return (
                    <div key={inv.id} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-[14px] text-espresso truncate">{inv.invitee_name}</p>
                        <p className="font-sans text-[11px] text-taupe">{inv.invitee_email} · {date}</p>
                      </div>
                      <span className={`font-sans text-[10px] font-semibold uppercase tracking-[0.18em] shrink-0 ${displayStatus.color}`}>
                        {displayStatus.label}
                      </span>
                      {(inv.status === "pending" && !expired) && (
                        <button
                          onClick={() => handleCopy(link, inv.id)}
                          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-cream text-taupe transition-colors hover:bg-cream shrink-0"
                          title="Copy invite link"
                        >
                          {copied === inv.id
                            ? <Check className="h-3 w-3 text-sage" strokeWidth={2} />
                            : <Copy className="h-3 w-3" strokeWidth={1.5} />}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-cream" />
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-taupe">or</p>
          <div className="flex-1 h-px bg-cream" />
        </div>

        {/* ── Generic share link ── */}
        <div className="space-y-3">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
            Share your link
          </p>
          <div className="rounded-2xl border border-cream bg-paper overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-cream">
              <Link2 className="h-4 w-4 text-taupe shrink-0" strokeWidth={1.5} />
              <p className="flex-1 font-sans text-[12px] text-cocoa truncate select-all">
                {genericLink}
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-cream">
              <button
                onClick={() => handleShare(genericLink)}
                className="flex items-center justify-center gap-2 px-4 py-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cream"
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Share
              </button>
              <button
                onClick={() => handleCopy(genericLink, "generic")}
                className="flex items-center justify-center gap-2 px-4 py-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cream"
              >
                {copied === "generic"
                  ? <Check className="h-3.5 w-3.5 text-sage" strokeWidth={2} />
                  : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
                {copied === "generic" ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
          <p className="font-sans text-[11px] text-taupe text-center leading-relaxed">
            Anyone who signs up through this link will be connected to you.
          </p>
        </div>

        {/* Note about approval */}
        <div className="rounded-2xl border border-cream bg-paper px-4 py-4 flex items-start gap-3">
          <Clock className="h-4 w-4 text-taupe mt-0.5 shrink-0" strokeWidth={1.5} />
          <p className="font-sans text-[12px] text-taupe leading-relaxed">
            New members require approval before accessing the app. You'll be notified when someone you invited joins.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default InviteFriend;
