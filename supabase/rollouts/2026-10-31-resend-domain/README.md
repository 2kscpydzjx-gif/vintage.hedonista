# Resend domain sender — compatibility rollout

This is the existing live resend-email handler with a bounded domain change.
Baseline content SHA-256: fc9aa1805edf189069d908e7ee26c522e4309ce139b4ccadca2dbcf6c50916d2.

Changes:

- Read ORDER_EMAIL_FROM instead of hardcoding the Resend onboarding sender.
- Reject malformed sender values and header injection. The onboarding fallback is permitted only in test mode.
- Pin the Supabase client to npm:@supabase/supabase-js@2.118.0.

The owner verified vintazhka.com.ua in Resend and configured:

    ORDER_EMAIL_FROM=Vintazhka <orders@vintazhka.com.ua>
    TEST_MODE=true
    TEST_EMAIL=<owner-controlled address, stored only in Supabase Secrets>

Deploy this entrypoint to the existing resend-email function with
**verify_jwt=true**, preserving its current gateway setting. Do not apply the
root supabase/config.toml or deploy the root function as part of this change:
those belong to the separately staged server-mail rollout.

supabase/functions/resend-email/index.ts remains the future shared handler.
It requires orders.vh_email_version, a secret-authenticated database webhook,
and frontend/admin transport configuration. Those prerequisites are currently
absent from the live project. Deploying that handler alone would break delivery.

This compatibility change does not complete authorization, guest delivery,
durable retries, or duplicate suppression. **Keep TEST_MODE=true** until the
server-mail rollout is verified. It does not enable customer delivery or change
the database, webhook, frontend/admin configuration, or templates.

Validation: node tests/resend-domain-sender.mjs

The test executes this exact deployment source with mocked database/provider
dependencies and covers sender selection, all statuses, test recipient routing,
invalid configuration, empty email, and provider/query failures. It sends no mail.
Production deployment must be read back and compared with this source; an
unauthenticated request must still be rejected by the JWT gateway.

## Deployment verification — 2026-10-31

Deployed to project yffwjgwwkapdrpwyjwfp as resend-email version 13, ACTIVE,
with verify_jwt=true. Read-back source exactly matched the tested deployment
file (SHA-256 5a68c0cd141fe6a0b2d3f4258d399177a0d0291f4dccabf40693bd8682ef9e2e).
Live OPTIONS returned 200; POST without Authorization returned 401 before the
handler. These checks sent no mail. Actual provider delivery remains to be
verified using an owner-controlled test order while TEST_MODE=true.

## Mail branding and delivery investigation

All order-email subjects, header text, fallback shop label, thank-you text and
signature now use Vintazhka. The provider sender display name is normalized to
Vintazhka while the email address remains controlled by ORDER_EMAIL_FROM; an
older configured display name therefore cannot restore the former mail brand.
The separately staged shared handler and example configuration match this brand.

The owner reported no initial email for control order 39 but received the
confirmed-status email. Live function request logs show POST 200 at
2026-10-31 12:24:21 UTC (creation) and POST 200 at 12:26:30 UTC (confirmation),
with no function error logs in that interval. The order has both an account
and email; no recipient or customer data was copied into this repository.
HTTP 200 does not establish inbox delivery. Resend delivery events for the
initial message still need inspection; no speculative checkout change was made.

Future successful sends log order_email_accepted with provider email ID, opaque
order ID, status and test-mode flag. Missing-email skips log order_email_skipped.
Neither log includes customer name, recipient address, message HTML or secrets.
