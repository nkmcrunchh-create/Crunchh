import { Router } from "express";
import { listActiveProducts } from "../services/products.js";

export const productsRouter = Router();

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
        active: product.active
      }))
    });
  } catch (error) {
    next(error);
  }
});
