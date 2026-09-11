# CRUNCHH Commerce

CRUNCHH is a Node.js + TypeScript storefront for a premium Indian snack catalog. The public website now sends direct consumer orders to trusted marketplaces, where customers can use the platform's payment, delivery tracking, returns, and order history. Bulk and gifting enquiries open WhatsApp with structured details pre-filled for the CRUNCHH team.

## Current Architecture

```mermaid
flowchart LR
  Browser[index.html + assets/js/main.js] --> Products[Products and reviews API]
  Products --> DB[(Cloudflare D1 or Postgres)]
  Browser --> Marketplaces[ONDC / Amazon / Flipkart / AJIO]
  Browser --> WhatsApp[WhatsApp bulk, gifting, and support enquiries]
  Admin[/admin] --> DB
  Worker[Cloudflare Worker] --> Container[Cloudflare Container]
  Container --> Express[Express API + static assets]
```

The storefront is intentionally lightweight:

- product discovery and reviews are rendered by `index.html`, `assets/css/style.css`, and `assets/js/main.js`
- product and review data can still be served from `/api/products` and managed through `/admin`
- local payment gateway checkout, delivery tracking pages, shipment booking, and invoice flows are not mounted in the public Express app
- legacy outbox processing is disabled unless `OUTBOX_ENABLED=true`
- marketplace URLs live in `CONFIG.marketplaceOrderLinks` inside `assets/js/main.js`
- bulk and gifting forms build WhatsApp messages for `+91 73030 33324`

## Local Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

Open `http://localhost:3000`.

## Database

Production is configured for Cloudflare D1 through:

```env
DATABASE_PROVIDER=d1
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_D1_API_TOKEN=
```

Run D1 migrations and seed products with:

```bash
npm run d1:migrate
npm run db:seed
```

The seeded catalog includes six 80 g CRUNCHH products:

- Stick Crunchh
- Lotus Crunchh
- Ruby Crunchh
- Leafy Crunchh
- Fusion Crunchh
- Puff Crunchh

## Marketplace Links

Update these URLs before launch in `assets/js/main.js`:

```js
marketplaceOrderLinks: {
  ondc: "https://www.mystore.in/en/search?q=CRUNCHH%20snacks",
  amazon: "https://www.amazon.in/s?k=CRUNCHH+snacks",
  flipkart: "https://www.flipkart.com/search?q=CRUNCHH%20snacks",
  ajio: "https://www.ajio.com/search/?text=CRUNCHH%20snacks",
}
```

Use final product or seller-page URLs once the marketplace listings are live.

## WhatsApp Forms

The public site has two structured WhatsApp flows:

- bulk orders from `#bulk`
- gifting combo orders from `#gifting`

Both open WhatsApp with the customer-entered details pre-filled. No message is sent until the customer confirms inside WhatsApp.

## Deployment

This repo deploys to Cloudflare Workers + Containers. The Worker entry is `src/cloudflare-container-worker.ts`; the container runs `node dist/src/server.js`.

```bash
npm run build
npm test
npm run deploy:cloudflare
```

Production still requires D1, admin, seller/legal, and basic runtime secrets, but no longer requires Razorpay, NimbusPost, or R2 invoice credentials for the public storefront.

## Admin

Generate a bcrypt hash:

```bash
npm run admin:hash -- "replace-with-a-long-admin-password"
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`, then seed the database. The admin panel remains available at `/admin` for catalog and review management.

## Verification

```bash
npm run build
npm test
```

Health endpoints:

- `/health`
- `/ready`
