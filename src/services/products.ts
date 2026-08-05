import { prisma } from "../db/prisma.js";

export async function listActiveProducts() {
  return prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function getProductsForCart(productIds: string[]) {
  return prisma.product.findMany({
    where: {
      OR: [
        { id: { in: productIds } },
        { slug: { in: productIds } }
      ]
    }
  });
}
