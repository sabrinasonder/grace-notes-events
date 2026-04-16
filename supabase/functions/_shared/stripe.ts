// supabase/functions/_shared/stripe.ts
import Stripe from "https://esm.sh/stripe@18.5.0";

export type StripeEnv = 'sandbox' | 'live';

export function getStripeSecretKey(env: StripeEnv): string {
  const key = env === 'sandbox'
    ? Deno.env.get('STRIPE_SANDBOX_SECRET_KEY')
    : Deno.env.get('STRIPE_LIVE_SECRET_KEY');
  if (!key) throw new Error(`STRIPE_${env.toUpperCase()}_SECRET_KEY is not configured`);
  return key;
}

export function createStripeClient(env: StripeEnv): Stripe {
  return new Stripe(getStripeSecretKey(env));
}
