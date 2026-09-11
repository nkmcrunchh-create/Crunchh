# CRUNCHH Architecture Report

The repository is a Cloudflare-oriented Node.js + TypeScript storefront. It keeps the premium static storefront feel while using an Express backend for products, reviews, admin, health checks, and deployment readiness.

## Public Flow

- The homepage renders product cards from `assets/js/main.js`.
- Product/review data can be refreshed from `/api/products` and `/api/reviews`.
- Consumer checkout is intentionally delegated to ONDC, Amazon, Flipkart, and AJIO links defined in frontend config.
- Customer payment, shipment tracking, returns, and order history are handled by the marketplace selected by the customer.
- Bulk and gifting enquiries open WhatsApp with structured details pre-filled for the CRUNCHH support number.

## Backend Flow

- `src/app.ts` mounts health, products, admin, and internal job routes.
- Public checkout, Razorpay payment, NimbusPost shipping, webhook, invoice, and tracking routes are no longer mounted.
- Legacy outbox processing is opt-in through `OUTBOX_ENABLED=true`.
- The database layer supports Cloudflare D1 in production and the existing Prisma/Postgres path for non-Cloudflare usage.
- The admin panel still manages product catalog, inventory fields, active status, prices, and review content.

## Deployment Shape

- `wrangler.jsonc` deploys a Cloudflare Worker that forwards traffic to a Cloudflare Container.
- `Dockerfile` builds the Node application and starts `dist/src/server.js`.
- Production readiness now checks runtime, database, admin, and seller/legal configuration only.
- Razorpay, NimbusPost, and R2 invoice credentials are no longer deployment blockers for the public site.

## Key Tradeoff

The app no longer owns payment authorization or delivery status. That reduces operational risk and secret management, while giving customers tracking and order history through marketplaces they already use. Direct CRUNCHH handling remains available for bulk and gifting via WhatsApp.
