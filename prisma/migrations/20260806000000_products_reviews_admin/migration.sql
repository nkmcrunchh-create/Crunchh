ALTER TABLE "Product" ADD COLUMN "imageUrls" TEXT;
ALTER TABLE "Product" ADD COLUMN "tagline" TEXT;
ALTER TABLE "Product" ADD COLUMN "description" TEXT;

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "quote" TEXT,
    "screenshotUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Review_active_sortOrder_idx" ON "Review"("active", "sortOrder");
