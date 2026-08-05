import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const products = [
  ["stick-crunchh", "CRH-STICK-80", "Stick Crunchh", "Soya Sticks", "Chatpata Magic", 14900, "assets/img/stick-crunchh.png"],
  ["lotus-crunchh", "CRH-LOTUS-80", "Lotus Crunchh", "Makhana Chips", "Cream & Onion", 17500, "assets/img/lotus-crunchh.png"],
  ["ruby-crunchh", "CRH-RUBY-80", "Ruby Crunchh", "Beetroot Chips", "Earthy & Sweet", 15900, "assets/img/ruby-crunchh.png"],
  ["leafy-crunchh", "CRH-LEAFY-80", "Leafy Crunchh", "Palak Chips", "Spearmint Pudina", 15900, "assets/img/leafy-crunchh.png"],
  ["fusion-crunchh", "CRH-FUSION-80", "Fusion Crunchh", "Assorted Chips", "Rainbow Mix", 15900, "assets/img/fusion-crunchh.png"],
  ["puff-crunchh", "CRH-PUFF-80", "Puff Crunchh", "Puffed Rice & Crisps", "Theekhi Chilli", 13900, "assets/img/puff-crunchh.png"]
] as const;

async function main() {
  for (const [slug, sku, name, category, flavour, pricePaise, imageUrl] of products) {
    await prisma.product.upsert({
      where: { slug },
      update: { sku, name, category, flavour, pricePaise, imageUrl, active: true, inventoryQuantity: 250 },
      create: {
        slug,
        sku,
        name,
        category,
        flavour,
        weightGrams: 80,
        pricePaise,
        imageUrl,
        active: true,
        inventoryQuantity: 250
      }
    });
  }

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH) {
    await prisma.adminUser.upsert({
      where: { email: process.env.ADMIN_EMAIL.toLowerCase() },
      update: { passwordHash: process.env.ADMIN_PASSWORD_HASH },
      create: { email: process.env.ADMIN_EMAIL.toLowerCase(), passwordHash: process.env.ADMIN_PASSWORD_HASH }
    });
  } else if (process.env.NODE_ENV !== "production") {
    await prisma.adminUser.upsert({
      where: { email: "admin@crunchh.local" },
      update: {},
      create: { email: "admin@crunchh.local", passwordHash: await bcrypt.hash("change-me-now", 12) }
    });
  }
}

main()
  .finally(async () => prisma.$disconnect());
