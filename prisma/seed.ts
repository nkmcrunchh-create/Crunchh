import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const adminEmail = "admin@crunch";
const adminPassword = "qawsedrf1234";

const products = [
  ["stick-crunchh", "CRH-STICK-80", "Stick Crunchh", "Soya Sticks", "Chatpata Magic", 14900, "assets/img/optimized/stick-crunchh.jpg", ["assets/img/optimized/stick-crunchh.jpg", "assets/img/optimized/stick-crunchh2.jpg"], "Signature heat", "Sharp masala, crisp soya, finished for a clean savoury snap."],
  ["lotus-crunchh", "CRH-LOTUS-80", "Lotus Crunchh", "Makhana Chips", "Cream & Onion", 17500, "assets/img/optimized/lotus-crunchh.jpg", ["assets/img/optimized/lotus-crunchh.jpg", "assets/img/optimized/lotus-crunchh2.jpg"], "Soft cream. Quiet crunch.", "Airy makhana with a polished cream and onion finish."],
  ["ruby-crunchh", "CRH-RUBY-80", "Ruby Crunchh", "Beetroot Chips", "Earthy & Sweet", 15900, "assets/img/optimized/ruby-crunchh.jpg", ["assets/img/optimized/ruby-crunchh.jpg", "assets/img/optimized/ruby-crunchh2.jpg"], "Ruby crisp", "Earthy beetroot, lightly sweet, cut into a vivid crisp bite."],
  ["leafy-crunchh", "CRH-LEAFY-80", "Leafy Crunchh", "Palak Chips", "Spearmint Pudina", 15900, "assets/img/optimized/leafy-crunchh.jpg", ["assets/img/optimized/leafy-crunchh.jpg", "assets/img/optimized/leafy-crunchh2.jpg"], "Fresh green snap", "Palak crunch lifted with cool spearmint pudina."],
  ["fusion-crunchh", "CRH-FUSION-80", "Fusion Crunchh", "Assorted Chips", "Rainbow Mix", 15900, "assets/img/optimized/fusion-crunchh.jpg", ["assets/img/optimized/fusion-crunchh.jpg", "assets/img/optimized/fusion-crunchh2.jpg"], "The house edit", "A curated mix of colours, textures, and CRUNCHH signatures."],
  ["puff-crunchh", "CRH-PUFF-80", "Puff Crunchh", "Puffed Rice & Crisps", "Theekhi Chilli", 13900, "assets/img/optimized/puff-crunchh.jpg", ["assets/img/optimized/puff-crunchh.jpg", "assets/img/optimized/puff-crunchh2.jpg"], "Featherlight fire", "Puffed rice and crisps with a bright chilli lift."]
] as const;

async function main() {
  for (const [slug, sku, name, category, flavour, pricePaise, imageUrl, imageUrls, tagline, description] of products) {
    await prisma.product.upsert({
      where: { slug },
      update: { sku, name, category, flavour, pricePaise, imageUrl, imageUrls: JSON.stringify(imageUrls), tagline, description, active: true, inventoryQuantity: 250 },
      create: {
        slug,
        sku,
        name,
        category,
        flavour,
        weightGrams: 80,
        pricePaise,
        imageUrl,
        imageUrls: JSON.stringify(imageUrls),
        tagline,
        description,
        active: true,
        inventoryQuantity: 250
      }
    });
  }

  const passwordHash = process.env.ADMIN_PASSWORD_HASH || await bcrypt.hash(adminPassword, 12);
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash }
  });

  await prisma.review.upsert({
    where: { id: "seed-review-1" },
    update: {},
    create: {
      id: "seed-review-1",
      customerName: "Crunchh customer",
      rating: 5,
      quote: "Fresh, crisp, and beautifully packed.",
      screenshotUrl: "",
      active: true,
      sortOrder: 1
    }
  });
}

main()
  .finally(async () => prisma.$disconnect());
