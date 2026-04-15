import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, fullName, city } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "missing_token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the invite
    const { data: invite, error } = await supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (error || !invite) {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_invite" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      await supabase
        .from("invites")
        .update({ status: "expired" })
        .eq("id", invite.id);

      return new Response(
        JSON.stringify({ success: false, error: "expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Mark invite as accepted
    await supabase
      .from("invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    // If a user already exists with this email, update their profile
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const matchingUser = existingUser?.users?.find(
      (u) => u.email?.toLowerCase() === invite.invitee_email.toLowerCase()
    );

    if (matchingUser) {
      // Update their profile with name/city if provided
      const updates: Record<string, any> = {};
      if (fullName) updates.full_name = fullName;
      if (city) updates.city = city;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from("profiles")
          .update(updates)
          .eq("id", matchingUser.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "internal_error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
