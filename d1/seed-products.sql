INSERT INTO "Product" (id, slug, sku, name, category, flavour, weightGrams, pricePaise, active, inventoryQuantity, imageUrl, taxRateBps, createdAt, updatedAt)
VALUES
  ('stick-crunchh', 'stick-crunchh', 'CRH-STICK-80', 'Stick Crunchh', 'Soya Sticks', 'Chatpata Magic', 80, 14900, 1, 250, 'assets/img/stick-crunchh.png', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('lotus-crunchh', 'lotus-crunchh', 'CRH-LOTUS-80', 'Lotus Crunchh', 'Makhana Chips', 'Cream & Onion', 80, 17500, 1, 250, 'assets/img/lotus-crunchh.png', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ruby-crunchh', 'ruby-crunchh', 'CRH-RUBY-80', 'Ruby Crunchh', 'Beetroot Chips', 'Earthy & Sweet', 80, 15900, 1, 250, 'assets/img/ruby-crunchh.png', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('leafy-crunchh', 'leafy-crunchh', 'CRH-LEAFY-80', 'Leafy Crunchh', 'Palak Chips', 'Spearmint Pudina', 80, 15900, 1, 250, 'assets/img/leafy-crunchh.png', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('fusion-crunchh', 'fusion-crunchh', 'CRH-FUSION-80', 'Fusion Crunchh', 'Assorted Chips', 'Rainbow Mix', 80, 15900, 1, 250, 'assets/img/fusion-crunchh.png', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('puff-crunchh', 'puff-crunchh', 'CRH-PUFF-80', 'Puff Crunchh', 'Puffed Rice & Crisps', 'Theekhi Chilli', 80, 13900, 1, 250, 'assets/img/puff-crunchh.png', 1200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
  taxRateBps = excluded.taxRateBps,
  updatedAt = CURRENT_TIMESTAMP;
