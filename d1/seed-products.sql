INSERT INTO "Product" (id, slug, sku, name, category, flavour, weightGrams, pricePaise, active, inventoryQuantity, imageUrl, imageUrls, tagline, description, taxRateBps, createdAt, updatedAt)
VALUES
  ('stick-crunchh', 'stick-crunchh', 'CRH-STICK-80', 'Stick Crunchh', 'Soya Sticks', 'Chatpata Magic', 80, 14900, 1, 250, 'assets/img/optimized/stick-crunchh.jpg', '["assets/img/optimized/stick-crunchh.jpg","assets/img/optimized/stick-crunchh2.jpg"]', 'Signature heat', 'Sharp masala, crisp soya, finished for a clean savoury snap.', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('lotus-crunchh', 'lotus-crunchh', 'CRH-LOTUS-80', 'Lotus Crunchh', 'Makhana Chips', 'Cream & Onion', 80, 17500, 1, 250, 'assets/img/optimized/lotus-crunchh.jpg', '["assets/img/optimized/lotus-crunchh.jpg","assets/img/optimized/lotus-crunchh2.jpg"]', 'Soft cream. Quiet crunch.', 'Airy makhana with a polished cream and onion finish.', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ruby-crunchh', 'ruby-crunchh', 'CRH-RUBY-80', 'Ruby Crunchh', 'Beetroot Chips', 'Earthy & Sweet', 80, 15900, 1, 250, 'assets/img/optimized/ruby-crunchh.jpg', '["assets/img/optimized/ruby-crunchh.jpg","assets/img/optimized/ruby-crunchh2.jpg"]', 'Ruby crisp', 'Earthy beetroot, lightly sweet, cut into a vivid crisp bite.', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('leafy-crunchh', 'leafy-crunchh', 'CRH-LEAFY-80', 'Leafy Crunchh', 'Palak Chips', 'Spearmint Pudina', 80, 15900, 1, 250, 'assets/img/optimized/leafy-crunchh.jpg', '["assets/img/optimized/leafy-crunchh.jpg","assets/img/optimized/leafy-crunchh2.jpg"]', 'Fresh green snap', 'Palak crunch lifted with cool spearmint pudina.', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('fusion-crunchh', 'fusion-crunchh', 'CRH-FUSION-80', 'Fusion Crunchh', 'Assorted Chips', 'Rainbow Mix', 80, 15900, 1, 250, 'assets/img/optimized/fusion-crunchh.jpg', '["assets/img/optimized/fusion-crunchh.jpg","assets/img/optimized/fusion-crunchh2.jpg"]', 'The house edit', 'A curated mix of colours, textures, and CRUNCHH signatures.', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('puff-crunchh', 'puff-crunchh', 'CRH-PUFF-80', 'Puff Crunchh', 'Puffed Rice & Crisps', 'Theekhi Chilli', 80, 13900, 1, 250, 'assets/img/optimized/puff-crunchh.jpg', '["assets/img/optimized/puff-crunchh.jpg","assets/img/optimized/puff-crunchh2.jpg"]', 'Featherlight fire', 'Puffed rice and crisps with a bright chilli lift.', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(slug) DO UPDATE SET
  sku = excluded.sku,
  name = excluded.name,
  category = excluded.category,
  flavour = excluded.flavour,
  weightGrams = excluded.weightGrams,
  pricePaise = excluded.pricePaise,
  active = excluded.active,
  inventoryQuantity = excluded.inventoryQuantity,
  imageUrl = excluded.imageUrl,
  imageUrls = excluded.imageUrls,
  tagline = excluded.tagline,
  description = excluded.description,
  taxRateBps = excluded.taxRateBps,
  updatedAt = CURRENT_TIMESTAMP;
