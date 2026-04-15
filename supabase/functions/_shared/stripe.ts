const GATEWAY_URL = "https://connector-gateway.lovable.dev/stripe/v1";

export function getStripeHeaders(env: "sandbox" | "live" = "sandbox") {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const keyName = env === "live" ? "STRIPE_LIVE_API_KEY" : "STRIPE_SANDBOX_API_KEY";
  const STRIPE_API_KEY = Deno.env.get(keyName);
  if (!STRIPE_API_KEY) throw new Error(`${keyName} is not configured`);

  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": STRIPE_API_KEY,
  };
}

export async function stripeRequest(
  path: string,
  options: {
    method?: string;
    body?: Record<string, string>;
    env?: "sandbox" | "live";
  } = {}
) {
  const { method = "POST", body, env = "sandbox" } = options;
  const headers: Record<string, string> = {
    ...getStripeHeaders(env),
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers,
    body: body ? new URLSearchParams(body).toString() : undefined,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Stripe API error [${response.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}
