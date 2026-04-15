import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { stripeRequest } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id, success_url, cancel_url } = await req.json();
    if (!event_id || !success_url || !cancel_url) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, price_cents, host_id, capacity")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.price_cents <= 0) {
      return new Response(JSON.stringify({ error: "This is a free event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already paid
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .maybeSingle();

    if (existingPayment) {
      return new Response(JSON.stringify({ error: "Already paid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine env
    const url = new URL(req.url);
    const env = (url.searchParams.get("env") as "sandbox" | "live") || "sandbox";

    // Create Stripe Checkout Session
    const session = await stripeRequest("/checkout/sessions", {
      env,
      body: {
        mode: "payment",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": event.title,
        "line_items[0][price_data][unit_amount]": String(event.price_cents),
        "line_items[0][quantity]": "1",
        success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url,
        "metadata[event_id]": event_id,
        "metadata[user_id]": user.id,
        customer_email: user.email || "",
      },
    });

    // Create pending payment record
    await supabase.from("payments").insert({
      event_id,
      user_id: user.id,
      stripe_session_id: session.id,
      amount_cents: event.price_cents,
      status: "pending",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Checkout error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
