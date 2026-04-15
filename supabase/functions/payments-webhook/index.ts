import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const env = (url.searchParams.get("env") as StripeEnv) || "sandbox";

    const webhookSecretKey = env === "live"
      ? "PAYMENTS_LIVE_WEBHOOK_SECRET"
      : "PAYMENTS_SANDBOX_WEBHOOK_SECRET";
    const webhookSecret = Deno.env.get(webhookSecretKey);

    if (!webhookSecret) {
      console.error(`${webhookSecretKey} not configured`);
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    // Verify webhook signature using Stripe SDK
    const stripe = createStripeClient(env);
    let event: any;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const eventId = session.metadata?.event_id;
        const userId = session.metadata?.user_id;

        if (!eventId || !userId) {
          console.error("Missing metadata in session:", session.id);
          break;
        }

        // Update payment status
        await supabase
          .from("payments")
          .update({ status: "completed" })
          .eq("stripe_session_id", session.id);

        // Create/update RSVP as going + paid
        const { data: existingRsvp } = await supabase
          .from("rsvps")
          .select("id")
          .eq("event_id", eventId)
          .eq("user_id", userId)
          .maybeSingle();

        if (existingRsvp) {
          await supabase
            .from("rsvps")
            .update({ status: "going", paid: true, stripe_payment_id: session.id })
            .eq("id", existingRsvp.id);
        } else {
          await supabase.from("rsvps").insert({
            event_id: eventId,
            user_id: userId,
            status: "going",
            paid: true,
            stripe_payment_id: session.id,
          });
        }

        // Send payment receipt email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .single();

        const { data: eventData } = await supabase
          .from("events")
          .select("title, starts_at, price_cents")
          .eq("id", eventId)
          .single();

        if (profile?.email && eventData) {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "payment-receipt",
              recipientEmail: profile.email,
              idempotencyKey: `payment-receipt-${session.id}`,
              templateData: {
                eventTitle: eventData.title,
                amount: `$${(eventData.price_cents / 100).toFixed(2)}`,
                eventDate: new Date(eventData.starts_at).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }),
              },
            },
          });
        }

        console.log(`Payment completed for event ${eventId}, user ${userId}`);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        await supabase
          .from("payments")
          .update({ status: "expired" })
          .eq("stripe_session_id", session.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
