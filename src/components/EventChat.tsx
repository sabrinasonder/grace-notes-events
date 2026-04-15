import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, ImagePlus, X, Loader2, Reply, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventChatProps {
  eventId: string;
  userId: string;
  isHost: boolean;
  eventTitle: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const EventChat = ({ eventId, userId, isHost, eventTitle }: EventChatProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isNearBottom = useRef(true);

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat_messages", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, profiles!messages_sender_id_fkey(full_name, avatar_url)")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch replied messages separately
      const replyIds = (data || []).filter((m: any) => m.reply_to_id).map((m: any) => m.reply_to_id);
      let repliedMap: Record<string, any> = {};
      if (replyIds.length > 0) {
        const { data: replies } = await supabase
          .from("messages")
          .select("id, body, profiles!messages_sender_id_fkey(full_name)")
          .in("id", replyIds);
        if (replies) {
          for (const r of replies) repliedMap[r.id] = r;
        }
      }

      return (data || []).map((m: any) => ({
        ...m,
        replied: m.reply_to_id ? repliedMap[m.reply_to_id] || null : null,
      }));
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `event_id=eq.${eventId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat_messages", eventId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, queryClient]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (isNearBottom.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isNearBottom.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  // Send message
  const handleSend = async () => {
    if ((!body.trim() && !image) || isSending) return;
    setIsSending(true);
    try {
      let imageUrl: string | null = null;
      if (image) {
        const ext = image.name.split(".").pop();
        const path = `chat/${eventId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("event-images")
          .upload(path, image);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("event-images")
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("messages").insert({
        event_id: eventId,
        sender_id: userId,
        body: body.trim(),
        image_url: imageUrl,
        reply_to_id: replyTo?.id || null,
      });
      if (error) throw error;

      // If image was posted, also add to event_photos
      if (imageUrl) {
        try {
          await supabase.from("event_photos").insert({
            event_id: eventId,
            uploaded_by: userId,
            image_url: imageUrl,
            source: "chat",
          });
        } catch {}
      }

      setBody("");
      setImage(null);
      setImagePreview(null);
      setReplyTo(null);
      isNearBottom.current = true;
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  // Delete message (soft)
  const handleDelete = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", messageId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["chat_messages", eventId] });
      setContextMenu(null);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 420px)", minHeight: "300px" }}>
      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-1 space-y-1"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
              This is the start of the conversation for <span className="font-medium text-foreground">{eventTitle}</span>. Say hi 👋
            </p>
          </div>
        ) : (
          messages.map((msg: any, i: number) => {
            const isOwn = msg.sender_id === userId;
            const sender = msg.profiles;
            const prevMsg = messages[i - 1];
            const sameAuthorAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id;
            const replied = msg.replied;

            return (
              <div key={msg.id} className={cn("relative group", isOwn ? "flex flex-col items-end" : "flex flex-col items-start")}>
                {/* Sender name — only show if different author or first message */}
                {!isOwn && !sameAuthorAsPrev && (
                  <span
                    className="mt-3 mb-0.5 px-3"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.15em",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {sender?.full_name || "Member"}
                  </span>
                )}

                {/* Reply preview */}
                {replied && (
                  <div className={cn(
                    "mx-3 mb-0.5 rounded-xl px-3 py-1.5 border border-border/50 max-w-[85%]",
                    isOwn ? "bg-primary/10" : "bg-card/50"
                  )}>
                    <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "hsl(var(--muted-foreground))" }}>
                      {replied.profiles?.full_name || "Member"}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{replied.body}</p>
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={cn(
                    "relative max-w-[85%] rounded-2xl px-4 py-2.5",
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/50"
                  )}
                  style={!isOwn ? { backgroundColor: "#F4EFE6" } : undefined}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu(msg.id);
                  }}
                  onClick={(e) => {
                    // Long-press simulation for mobile — use context menu
                    e.stopPropagation();
                  }}
                >
                  {msg.image_url && (
                    <img src={msg.image_url} alt="" className="rounded-xl max-h-48 w-full object-cover mb-1.5" />
                  )}
                  {msg.body && (
                    <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", isOwn ? "text-primary-foreground" : "text-foreground")}>
                      {msg.body}
                    </p>
                  )}
                  <p
                    className="mt-1"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "10px",
                      color: isOwn ? "hsl(var(--primary-foreground) / 0.6)" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {relativeTime(msg.created_at)}
                  </p>
                </div>

                {/* Context actions */}
                {contextMenu === msg.id && (
                  <div
                    className={cn(
                      "absolute z-30 flex gap-1 rounded-xl bg-card border border-border shadow-lg p-1",
                      isOwn ? "right-0 top-0 -translate-y-full" : "left-0 top-0 -translate-y-full"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setReplyTo(msg); setContextMenu(null); }}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 hover:bg-background transition-colors"
                    >
                      <Reply className="h-3.5 w-3.5 text-foreground" strokeWidth={1.5} />
                      <span className="text-xs text-foreground">Reply</span>
                    </button>
                    {(isOwn || isHost) && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" strokeWidth={1.5} />
                        <span className="text-xs text-destructive">Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-2">
          <Reply className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "hsl(var(--muted-foreground))" }}>
              {replyTo.profiles?.full_name || "Member"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.body}</p>
          </div>
          <button onClick={() => setReplyTo(null)}>
            <X className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="relative border-t border-border bg-card px-4 py-2">
          <img src={imagePreview} alt="" className="rounded-xl max-h-24 object-cover" />
          <button
            onClick={() => { setImage(null); setImagePreview(null); }}
            className="absolute top-3 right-5 flex h-6 w-6 items-center justify-center rounded-full bg-background/80"
          >
            <X className="h-3 w-3 text-foreground" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border bg-card px-3 py-2.5 flex items-end gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full hover:bg-background transition-colors"
        >
          <ImagePlus className="h-4.5 w-4.5 text-muted-foreground" strokeWidth={1.5} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setImage(file);
              setImagePreview(URL.createObjectURL(file));
            }
          }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] max-h-[100px]"
          style={{ fontFamily: "var(--font-body)" }}
        />
        <button
          onClick={handleSend}
          disabled={(!body.trim() && !image) || isSending}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary transition-all hover:opacity-90 disabled:opacity-40"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
          ) : (
            <Send className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );
};
