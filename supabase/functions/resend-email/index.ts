import { createClient } from "npm:@supabase/supabase-js@2";
import { createOrderEmailHandler } from "../_shared/order-email-handler.mjs";

// Both endpoints share authentication, recipient selection and idempotency keys.
Deno.serve(createOrderEmailHandler({ createClient, env: (name: string) => Deno.env.get(name) }));
