# Deploy CRUNCHH on Cloudflare

This guide deploys the CRUNCHH website as a Cloudflare Worker that routes traffic into a Cloudflare Container running the Node.js/Express app.

## Runtime

- Cloudflare Workers + Containers host the app.
- Cloudflare D1 stores product, review, admin, and legacy commerce tables.
- The public storefront sends consumer orders to ONDC, Amazon, Flipkart, and AJIO.
- Bulk and gifting orders are handled through WhatsApp links generated in the browser.

The public app no longer requires Razorpay, NimbusPost, or R2 invoice credentials.

## 1. Prepare Locally

```bash
npm install
npm run build
npm test
```

## 2. Configure D1

Create or reuse the `crunchh` D1 database:

```bash
npx wrangler d1 create crunchh
```

Set these values in Cloudflare secrets or environment:

```env
DATABASE_PROVIDER=d1
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_D1_API_TOKEN=
```

Apply migrations and seed products:

```bash
npm run d1:migrate
npm run db:seed
```

For a remote D1 seed:

```bash
npx wrangler d1 execute crunchh --remote --file d1/seed-products.sql
```

## 3. Configure Required Secrets

Set these before production:

```env
PUBLIC_BASE_URL=https://www.crunchh.store
FRONTEND_URL=https://www.crunchh.store
CORS_ALLOWED_ORIGINS=https://www.crunchh.store
CLOUDFLARE_D1_API_TOKEN=
SESSION_SECRET=
INTERNAL_JOB_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
SELLER_GSTIN=
SELLER_REGISTERED_ADDRESS=
SELLER_DISPATCH_ADDRESS=
SELLER_STATE=
SELLER_STATE_CODE=
SELLER_EMAIL=
```

Generate secrets locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
npm run admin:hash -- "replace-with-a-long-admin-password"
```

Use the helper when desired:

```bash
npm run cf:secrets:push -- .env.production
```

## 4. Marketplace Links

Before launch, replace the placeholder/search URLs in `assets/js/main.js` with final marketplace listing URLs:

```js
marketplaceOrderLinks: {
  ondc: "...",
  amazon: "...",
  flipkart: "...",
  ajio: "...",
}
```

These external platforms own payment, delivery tracking, returns, and order history.

## 5. Deploy

Make sure Docker Desktop is running, then:

```bash
npm run deploy:cloudflare
```

For an immediate container rollout:

```bash
npx wrangler deploy --containers-rollout immediate
```

The deployed container startup command is:

```bash
node dist/src/server.js
```

## 6. Attach Domain

In Cloudflare Dashboard:

1. Open Workers & Pages.
2. Select `crunchh-commerce`.
3. Go to Settings > Domains & Routes.
4. Add `www.crunchh.store`.
5. Confirm SSL is active.

For the apex domain, keep a proxied DNS record so `crunchh.store` reaches the Worker.

## 7. Verify

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

Smoke test:

- open the homepage on desktop and mobile
- click all four marketplace links
- submit the bulk form until WhatsApp opens with pre-filled text
- click each gifting combo WhatsApp CTA
- confirm `/admin` still loads for authorized users

## Rollback

If a deploy breaks, roll back from Cloudflare Workers & Pages > Deployments. Avoid rolling back database migrations unless you have confirmed the schema impact.
