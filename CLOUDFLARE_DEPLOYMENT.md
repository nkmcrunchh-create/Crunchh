# Deploy CRUNCHH Live on Cloudflare

This guide deploys the CRUNCHH website as a Cloudflare Worker that routes traffic into a Cloudflare Container running the Node.js/Express/Prisma app. This keeps the production backend compatible with Razorpay SDK, Prisma, PDFKit invoices, and secure webhook handling.

References:

- Cloudflare Containers: https://developers.cloudflare.com/containers/
- Containers getting started: https://developers.cloudflare.com/containers/get-started/
- Wrangler configuration and secrets: https://developers.cloudflare.com/workers/wrangler/configuration/
- Workers cron triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Worker custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- R2 S3 credentials: https://developers.cloudflare.com/r2/get-started/s3/

## 1. What You Will Use

- Cloudflare Workers + Containers for the app runtime.
- Cloudflare D1 for the production database.
- Cloudflare R2 private bucket for invoice PDFs.
- Razorpay for prepaid payments.
- NimbusPost for shipment serviceability, rates, booking, tracking, labels, and webhooks.
- Meta WhatsApp Cloud API for transactional order confirmations.

## 2. Prerequisites

Install locally:

```bash
node --version
npm --version
docker info
npx wrangler --version
```

You need:

- Cloudflare account with Workers Paid plan, because Containers require it.
- `crunchh.store` added to Cloudflare DNS.
- Docker Desktop running locally.
- Cloudflare D1 database ready.
- Razorpay live account.
- NimbusPost merchant API documentation and credentials.
- Meta WhatsApp Business Platform access.

## 3. Prepare the Repository

```bash
npm install
npm run build
npm test
npm audit --omit=dev
```

Expected:

- TypeScript build passes.
- Tests pass.
- Audit reports zero production vulnerabilities.

## 4. Create Production Environment File

Create a local file named `.env.production`. This file is ignored by Git.

```bash
cp .env.example .env.production
```

Never commit `.env.production`, `.env`, `.dev.vars`, API keys, webhook secrets, or downloaded credential files.

## 5. Generate Strong Local Secrets

Generate session and internal job secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Put the first value into:

```env
SESSION_SECRET=
```

Put the second value into:

```env
INTERNAL_JOB_SECRET=
```

Generate the admin password hash:

```bash
npm run admin:hash -- "replace-with-a-long-admin-password"
```

Put the output into:

```env
ADMIN_PASSWORD_HASH=
```

Set:

```env
ADMIN_EMAIL=owner@crunchh.store
```

## 6. Configure Cloudflare D1 Database

This repo is configured to use Cloudflare D1 in production through `DATABASE_PROVIDER=d1`. D1 is SQLite-compatible and is reached from the Cloudflare Container through Cloudflare's D1 REST API.

Create the database:

```bash
npx wrangler d1 create crunchh
```

Copy the returned database UUID.

Create a Cloudflare API token:

1. Cloudflare Dashboard > My Profile > API Tokens.
2. Create Custom Token.
3. Permissions:
   - Account > D1 > Edit
4. Account Resources:
   - Include your Cloudflare account.
5. Save the token securely.

Set these in `.env.production`:

```env
DATABASE_PROVIDER=d1
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_D1_API_TOKEN=
```

Apply D1 migrations locally before first deploy:

```bash
npm run d1:migrate
```

Apply D1 migrations before each deploy when new SQL files are added:

```bash
npm run d1:migrate
```

The Cloudflare Container starts the compiled server directly. It does not run migrations during cold start, which keeps port `3000` available quickly for Cloudflare's health checks.

Optional Postgres fallback remains available for non-Cloudflare hosting:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

## 7. Configure Cloudflare R2 for Invoices

In Cloudflare Dashboard:

1. Go to Storage & databases > R2.
2. Create bucket: `crunchh-invoices`.
3. Keep the bucket private.
4. Go to R2 > Overview > API Tokens > Manage.
5. Create an R2 token with Object Read & Write.
6. Scope it to the `crunchh-invoices` bucket.
7. Copy Access Key ID and Secret Access Key once.

Set:

```env
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_INVOICE_BUCKET=crunchh-invoices
```

## 8. Configure Public URLs and CORS

For live domain:

```env
PUBLIC_BASE_URL=https://www.crunchh.store
FRONTEND_URL=https://www.crunchh.store
CORS_ALLOWED_ORIGINS=https://www.crunchh.store
```

For a staging subdomain:

```env
PUBLIC_BASE_URL=https://staging.crunchh.store
FRONTEND_URL=https://staging.crunchh.store
CORS_ALLOWED_ORIGINS=https://staging.crunchh.store
```

## 9. Configure Razorpay

In Razorpay Dashboard:

1. Complete account activation.
2. Switch to Live Mode.
3. Account & Settings > API Keys.
4. Generate live key pair.
5. Set webhook endpoint after Cloudflare deploy:
   `https://www.crunchh.store/api/webhooks/razorpay`
6. Enable events:
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
   - refund events
7. Copy webhook secret.

Set:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_AUTO_CAPTURE=true
```

## 10. Configure NimbusPost

Do not guess endpoints. Use the merchant API documentation supplied by NimbusPost.

Set:

```env
SHIPPING_PROVIDER=nimbuspost
NIMBUSPOST_MOCK_MODE=false
NIMBUSPOST_BASE_URL=
NIMBUSPOST_SERVICEABILITY_PATH=
NIMBUSPOST_RATES_PATH=
NIMBUSPOST_CREATE_SHIPMENT_PATH=
NIMBUSPOST_TRACKING_PATH=
NIMBUSPOST_CANCEL_PATH=
NIMBUSPOST_LABEL_PATH=
NIMBUSPOST_API_KEY=
NIMBUSPOST_API_SECRET=
NIMBUSPOST_WEBHOOK_SECRET=
NIMBUSPOST_PICKUP_LOCATION_ID=
NIMBUSPOST_PICKUP_PINCODE=
NIMBUSPOST_RETURN_LOCATION_ID=
```

If NimbusPost uses email/password token auth instead of API key/secret, add those fields and update the adapter mapping before launch:

```env
NIMBUSPOST_API_EMAIL=
NIMBUSPOST_API_PASSWORD=
```

NimbusPost webhook URL:

```text
https://www.crunchh.store/api/webhooks/nimbuspost
```

If NimbusPost does not support webhook signatures, set:

```env
NIMBUSPOST_WEBHOOK_ROUTE_TOKEN=<long-random-token>
```

Then use:

```text
https://www.crunchh.store/api/webhooks/nimbuspost/<long-random-token>
```

## 11. Configure WhatsApp Cloud API

In Meta Business:

1. Create or select the business portfolio.
2. Add WhatsApp Business Platform.
3. Connect the CRUNCHH number.
4. Create a system-user token or long-lived access token.
5. Copy phone number ID and WhatsApp business account ID.
6. Set webhook verify token.
7. Configure webhook callback:
   `https://www.crunchh.store/api/webhooks/whatsapp`
8. Subscribe to messages and message status events.
9. Submit utility template `crunchh_order_confirmed`.

Set:

```env
WHATSAPP_ENABLED=true
WHATSAPP_GRAPH_API_VERSION=v21.0
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_ORDER_CONFIRMED_TEMPLATE=crunchh_order_confirmed
WHATSAPP_FALLBACK_ORDER_CONFIRMED_TEMPLATE=crunchh_order_confirmed_text
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_SUPPORT_NUMBER=917303033324
```

## 12. Configure Seller and Tax Details

Fill these only with accountant-approved values:

```env
SELLER_LEGAL_NAME=TRISHUL GROUPS LLP
SELLER_BRAND_NAME=CRUNCHH
SELLER_GSTIN=
SELLER_REGISTERED_ADDRESS=
SELLER_DISPATCH_ADDRESS=
SELLER_STATE=
SELLER_STATE_CODE=
SELLER_EMAIL=
SELLER_PHONE=917303033324
SELLER_WEBSITE=https://www.crunchh.store
INVOICE_PREFIX=CRH
TAX_INCLUSIVE_PRICES=true
DEFAULT_PRODUCT_TAX_RATE_BPS=1200
SHIPPING_TAX_RATE_BPS=1800
```

Do not launch until GST, HSN, product tax rate, shipping tax rate, invoice format, and declaration text are approved.

## 13. Configure Shipping Settings

```env
NCR_PREPAID_SHIPPING_PAISE=4900
NCR_COD_SHIPPING_PAISE=6900
FREE_SHIPPING_THRESHOLD_PAISE=49900
MAX_COD_ORDER_PAISE=500000
COD_ENABLED=true
NCR_STATES=Delhi,Haryana,Uttar Pradesh
NCR_POSTAL_CODES=
FALLBACK_SHIPPING_PAISE=7900
DEFAULT_PACKAGE_LENGTH_CM=18
DEFAULT_PACKAGE_WIDTH_CM=14
DEFAULT_PACKAGE_HEIGHT_CM=6
DEFAULT_EMPTY_PACKAGE_WEIGHT_GRAMS=35
```

Verify physical product packaging dimensions and weights before launch.

## 14. Log in to Cloudflare Wrangler

```bash
npx wrangler login
```

Confirm the correct account:

```bash
npx wrangler whoami
```

## 15. Push Credentials to Cloudflare

Option A, recommended helper:

```bash
npm run cf:secrets:push -- .env.production
```

Option B, one-by-one:

```bash
npx wrangler secret put CLOUDFLARE_D1_API_TOKEN
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
```

Important rules:

- Keep real credentials only in `.env.production` locally and in Cloudflare Secrets.
- Do not put secrets in `wrangler.jsonc`.
- Do not paste credentials into frontend JavaScript.
- Rotate any credential that was pasted into chat, email, screenshots, Git, or issue trackers.

## 16. Deploy to Cloudflare

Make sure Docker is running, then:

```bash
npm run deploy:cloudflare
```

Wrangler will:

1. Build the Docker image from `Dockerfile`.
2. Push it to Cloudflare’s container registry.
3. Deploy the Worker.
4. Configure the Container/Durable Object binding.

For a clean container rollout, use:

```bash
npx wrangler deploy --containers-rollout immediate
```

The deployed container startup command is:

```bash
node dist/src/server.js
```

If Wrangler prints a trailing `no such manifest` line after deployment, explicitly push the local image tag and redeploy with immediate rollout. Example:

```bash
npx wrangler containers push crunchh-commerce-crunchhcommercecontainer:<tag>
npx wrangler deploy --containers-rollout immediate
```

## 17. Attach the Domain

In Cloudflare Dashboard:

1. Workers & Pages.
2. Select `crunchh-commerce`.
3. Settings > Domains & Routes.
4. Add > Custom Domain.
5. Enter `www.crunchh.store`.
6. Confirm SSL is active.

Cloudflare recommends custom domains when the Worker is the origin for a hostname.

For the bare domain, `crunchh.store`, make sure Cloudflare DNS has a proxied apex record. Without it, visitors who omit `www` will see `ERR_NAME_NOT_RESOLVED` before the Worker is reached.

Add this DNS record in Cloudflare Dashboard > DNS > Records:

```text
Type: AAAA
Name: @
IPv6 address: 100::
Proxy status: Proxied
TTL: Auto
```

The Worker config already includes both routes:

```text
crunchh.store/*
www.crunchh.store/*
```

## 18. Seed Products and Admin

Seed products once from your local machine:

```bash
npx wrangler d1 execute crunchh --remote --file d1/seed-products.sql
```

Create or update the admin login row in D1. The admin email and password hash must live in the `AdminUser` table:

```sql
INSERT INTO AdminUser (id, email, passwordHash, createdAt, updatedAt)
VALUES ('<uuid>', 'owner@crunchh.store', '<bcrypt-hash>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(email) DO UPDATE SET passwordHash=excluded.passwordHash, updatedAt=CURRENT_TIMESTAMP;
```

To change the admin email later, update the `AdminUser` table directly. Example:

```bash
npx wrangler d1 execute crunchh --remote --command="UPDATE AdminUser SET email='owner@crunchh.store', updatedAt=CURRENT_TIMESTAMP WHERE email='old@example.com'"
```

The dashboard login checks only the database row; admin email is not controlled from frontend JavaScript.

## 19. Verify Live Health

```bash
curl https://www.crunchh.store/health
curl https://www.crunchh.store/ready
```

Expected:

```json
{"ok":true,"service":"crunchh-commerce"}
```

and:

```json
{"ready":true}
```

If `/ready` is false, check database connectivity and production readiness errors in Cloudflare Worker logs.

## 20. Configure Provider Webhooks

Razorpay:

```text
https://www.crunchh.store/api/webhooks/razorpay
```

NimbusPost:

```text
https://www.crunchh.store/api/webhooks/nimbuspost
```

WhatsApp:

```text
https://www.crunchh.store/api/webhooks/whatsapp
```

## 21. Run Live Smoke Tests

1. Open `https://www.crunchh.store`.
2. Add one product to cart.
3. Enter a real serviceable PIN code.
4. Place a prepaid Razorpay test/live small-value order.
5. Confirm payment is captured in Razorpay.
6. Confirm order row in database is `CAPTURED`.
7. Confirm shipment is booked and AWB saved.
8. Confirm invoice PDF is generated in R2.
9. Confirm WhatsApp template is sent.
10. Open `/track/{PUBLIC_ORDER_ID}`.
11. Download invoice using matching mobile verification.

## 22. Go-Live Switches

Before public launch:

```env
NODE_ENV=production
SHIPPING_PROVIDER=nimbuspost
NIMBUSPOST_MOCK_MODE=false
WHATSAPP_ENABLED=true
STORAGE_PROVIDER=r2
```

Confirm these are not enabled:

```env
SHIPPING_PROVIDER=mock
NIMBUSPOST_MOCK_MODE=true
WHATSAPP_ENABLED=false
STORAGE_PROVIDER=local
```

## 23. Operational Checks

Daily:

- Check Razorpay captures.
- Check NimbusPost booking failures.
- Check `OutboxJob` failed rows.
- Check WhatsApp failed notifications.
- Check R2 invoice uploads.

Weekly:

- Export orders CSV from `/admin`.
- Review stock and update inventory.
- Review failed COD/RTO patterns.
- Confirm database backups.

## 24. Rollback

If a deploy breaks:

1. In Cloudflare Workers & Pages, open `crunchh-commerce`.
2. Go to Deployments.
3. Roll back to the previous version.
4. Do not roll back database migrations blindly.
5. If needed, disable checkout by temporarily setting product `active=false` in the database.

## 25. Common Failures

`Production readiness failed. Mock shipping is enabled.`

- Set `SHIPPING_PROVIDER=nimbuspost`.
- Set `NIMBUSPOST_MOCK_MODE=false`.

`Production readiness failed. Local invoice storage is enabled.`

- Set `STORAGE_PROVIDER=r2`.
- Configure R2 credentials.

`NimbusPost production endpoint mapping is incomplete.`

- Add exact documented NimbusPost paths.
- Do not guess endpoints.

`/ready` database false.

- Check `DATABASE_PROVIDER=d1`.
- Check `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and `CLOUDFLARE_D1_API_TOKEN`.
- Confirm `npx wrangler d1 execute crunchh --remote --command "SELECT 1"` succeeds.

`Failed to start container: The container is not running, consider calling start()`.

- Confirm the container app is no longer provisioning: `npx wrangler containers list`.
- Confirm the image digest in `npx wrangler containers info <application-id>` matches the latest pushed image.
- Run `npx wrangler deploy --containers-rollout immediate`.

WhatsApp message failed.

- Check template approval, language code, token permissions, and phone number ID.
