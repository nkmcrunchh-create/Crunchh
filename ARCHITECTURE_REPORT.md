# CRUNCHH Architecture Report

The original repository was a static storefront with product data, cart state, WhatsApp order generation, and printable order copy handled in browser JavaScript. That design was simple, but it trusted browser-side product and order state too much for paid e-commerce.

This implementation keeps the existing storefront and visual structure, then adds a production-structured backend:

- Express + TypeScript API in `src/`
- PostgreSQL schema through Prisma in `prisma/schema.prisma`
- Product catalog seeded from `prisma/seed.ts`
- Server-side checkout calculation in integer paise
- Razorpay checkout order creation, signature verification, webhook capture processing, and dev mock payment
- Replaceable `ShippingProvider` interface with `MockShippingProvider` and guarded `NimbusPostShippingProvider`
- Centralized NimbusPost request mapping and status normalization
- Outbox-backed retries for shipment booking, invoice generation, and WhatsApp confirmation
- PDFKit invoice generation after AWB assignment
- Local or Supabase private invoice storage
- Meta WhatsApp Cloud API template sender with mock mode
- Admin login and minimal dashboard/API surface
- Health and readiness endpoints

Key security choices:

- Browser totals are not trusted.
- Price mismatches are rejected as tampering.
- Inventory is decremented inside the checkout transaction.
- Payment fulfilment is driven by server verification/webhooks, not browser success alone.
- Shipments are idempotent through the one-shipment-per-order constraint.
- WhatsApp order confirmations are deduped with `ORDER_CONFIRMED:{ORDER_ID}`.
- Invoice download requires matching customer mobile verification.
- Production refuses missing seller/legal/payment configuration and mock shipping.

Known production gaps:

- NimbusPost merchant API endpoints and exact response fields must be supplied before live mode.
- GSTIN, seller addresses, HSN values, tax rates, invoice wording, and invoice layout require accountant/legal approval.
- PostgreSQL-backed session storage should replace in-memory sessions before production scale.
- Full API integration tests need a disposable PostgreSQL database in CI.
