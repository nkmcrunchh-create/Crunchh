import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { listActiveProducts } from "../services/products.js";

export const productsRouter = Router();

function parseImageUrls(value: unknown, fallback?: string | null) {
  const images: string[] = [];
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) images.push(...parsed.map((item) => String(item || "").trim()));
    } catch {
      images.push(...value.split(/\r?\n|,/).map((item) => item.trim()));
    }
  }
  if (fallback) images.push(fallback);
  return [...new Set(images.filter(Boolean))];
}

productsRouter.get("/api/products", async (_req, res, next) => {
  try {
    const products = await listActiveProducts();
    res.json({
      products: products.map((product) => ({
        id: product.slug,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        category: product.category,
        flavour: product.flavour,
        weightGrams: product.weightGrams,
        pricePaise: product.pricePaise,
        imageUrl: product.imageUrl,
        imageUrls: parseImageUrls((product as any).imageUrls, product.imageUrl),
        tagline: (product as any).tagline,
        description: (product as any).description,
        active: product.active
      }))
    });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/api/reviews", async (_req, res, next) => {
  try {
    const reviews = await (prisma as any).review.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 12
    } as any);
    res.json({
      reviews: reviews.map((review: any) => ({
        id: review.id,
        customerName: review.customerName,
        rating: review.rating,
        quote: review.quote,
        screenshotUrl: review.screenshotUrl,
        active: review.active,
        sortOrder: review.sortOrder
      }))
    });
  } catch (error) {
    next(error);
  }
});
