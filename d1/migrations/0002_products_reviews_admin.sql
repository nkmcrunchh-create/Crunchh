ALTER TABLE "Product" ADD COLUMN "imageUrls" TEXT;
ALTER TABLE "Product" ADD COLUMN "tagline" TEXT;
ALTER TABLE "Product" ADD COLUMN "description" TEXT;

CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "customerName" TEXT NOT NULL,
  "rating" INTEGER NOT NULL DEFAULT 5,
  "quote" TEXT,
  "screenshotUrl" TEXT,
  "active" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "Review_active_sortOrder_idx" ON "Review"("active", "sortOrder");
