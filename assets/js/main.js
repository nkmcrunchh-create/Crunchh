const CONFIG = {
  whatsappNumber: "917303033324",
  currency: "Rs.",
  company: "Trishul Group",
  apiBase: "",
  marketplaceOrderLinks: {
    ondc: "https://www.mystore.in/en/search?q=CRUNCHH%20snacks",
    amazon: "https://www.amazon.in/s?k=CRUNCHH+snacks",
    flipkart: "https://www.flipkart.com/search?q=CRUNCHH%20snacks",
    ajio: "https://www.ajio.com/search/?text=CRUNCHH%20snacks",
  },
};

document.documentElement.classList.add("js-enabled");

const DEFAULT_CATALOG = [
  { id: "stick-crunchh", name: "Stick Crunchh", category: "Soya Sticks", flavour: "Chatpata Magic", tagline: "Signature heat", desc: "Sharp masala, crisp soya, finished for a clean savoury snap.", images: ["assets/img/optimized/stick-crunchh.jpg", "assets/img/optimized/stick-crunchh2.jpg"], active: true, variants: [{ id: "packet-80g", grams: 80, price: 149 }] },
  { id: "lotus-crunchh", name: "Lotus Crunchh", category: "Makhana Chips", flavour: "Cream & Onion", tagline: "Soft cream. Quiet crunch.", desc: "Airy makhana with a polished cream and onion finish.", images: ["assets/img/optimized/lotus-crunchh.jpg", "assets/img/optimized/lotus-crunchh2.jpg"], active: true, variants: [{ id: "packet-80g", grams: 80, price: 175 }] },
  { id: "ruby-crunchh", name: "Ruby Crunchh", category: "Beetroot Chips", flavour: "Earthy & Sweet", tagline: "Ruby crisp", desc: "Earthy beetroot, lightly sweet, cut into a vivid crisp bite.", images: ["assets/img/optimized/ruby-crunchh.jpg", "assets/img/optimized/ruby-crunchh2.jpg"], active: true, variants: [{ id: "packet-80g", grams: 80, price: 159 }] },
  { id: "leafy-crunchh", name: "Leafy Crunchh", category: "Palak Chips", flavour: "Spearmint Pudina", tagline: "Fresh green snap", desc: "Palak crunch lifted with cool spearmint pudina.", images: ["assets/img/optimized/leafy-crunchh.jpg", "assets/img/optimized/leafy-crunchh2.jpg"], active: true, variants: [{ id: "packet-80g", grams: 80, price: 159 }] },
  { id: "fusion-crunchh", name: "Fusion Crunchh", category: "Assorted Chips", flavour: "Rainbow Mix", tagline: "The house edit", desc: "A curated mix of colours, textures, and CRUNCHH signatures.", images: ["assets/img/optimized/fusion-crunchh.jpg", "assets/img/optimized/fusion-crunchh2.jpg"], active: true, variants: [{ id: "packet-80g", grams: 80, price: 159 }] },
  { id: "puff-crunchh", name: "Puff Crunchh", category: "Puffed Rice & Crisps", flavour: "Theekhi Chilli", tagline: "Featherlight fire", desc: "Puffed rice and crisps with a bright chilli lift.", images: ["assets/img/optimized/puff-crunchh.jpg", "assets/img/optimized/puff-crunchh2.jpg"], active: true, variants: [{ id: "packet-80g", grams: 80, price: 139 }] },
];

const DEFAULT_REVIEWS = [
  { id: "sample-review", customerName: "Crunchh customer", rating: 5, quote: "Fresh, crisp, and beautifully packed.", screenshotUrl: "", active: true, sortOrder: 1 },
];

const GIFT_COMBOS = [
  { id: "festival-6", name: "Festival Six", detail: "Six assorted 80g packs with ribbon-ready gifting.", packs: "6 packs", price: "Custom quote" },
  { id: "desk-duo", name: "Desk Drawer Duo", detail: "Two light everyday crunch packs for teams and clients.", packs: "2 packs", price: "Custom quote" },
  { id: "celebration-12", name: "Celebration Twelve", detail: "A larger hamper for family gifting, offices, and events.", packs: "12 packs", price: "Custom quote" },
];

let catalog = normalizeCatalog(DEFAULT_CATALOG);
let reviews = cloneCatalog(DEFAULT_REVIEWS);

function cloneCatalog(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeCatalog(items) {
  return cloneCatalog(items).map((product) => {
    const images = Array.isArray(product.images) ? product.images : [product.image].filter(Boolean);
    const variants = Array.isArray(product.variants) && product.variants.length
      ? product.variants
      : Object.entries(product.prices || {}).map(([, price], index) => ({ id: `packet-${index + 1}`, grams: index === 0 ? 25 : 120, price }));
    return {
      ...product,
      active: product.active !== false,
      image: images[0] || "",
      images: images.map((image) => String(image || "").trim()).filter(Boolean),
      variants: variants.map((variant, index) => ({
        id: variant.id || `packet-${index + 1}`,
        grams: Math.max(1, Number(variant.grams) || 1),
        price: Math.max(0, Number(variant.price) || 0),
      })),
    };
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  const amount = Number(value) || 0;
  return `${CONFIG.currency} ${amount.toLocaleString("en-IN")}`;
}

function packetLabel(variant) {
  return `${Number(variant.grams) || 0}g Packet`;
}

function productImages(product) {
  const images = Array.isArray(product.images) && product.images.length ? product.images : [product.image].filter(Boolean);
  const localFallbacks = product.id
    ? [`assets/img/optimized/${product.id}.jpg`, `assets/img/optimized/${product.id}2.jpg`, `assets/img/${product.id}.png`, `assets/img/${product.id}2.png`]
    : [];
  return [...new Set([...images, ...localFallbacks]
    .map((image) => String(image || "").trim().replace(/^\/+/, ""))
    .filter(Boolean))];
}

function productImageHtml(product) {
  const images = productImages(product);
  if (images.length) {
    const slides = images.map((image, index) => `
      <img src="${escapeHtml(image)}" width="520" height="650" loading="lazy" decoding="async" alt="${escapeHtml(product.name)} pack" class="${index === 0 ? "active" : ""}" data-slide-index="${index}">
    `).join("");
    const controls = images.length > 1 ? `
      <button class="slider-btn slider-btn--prev" type="button" data-slider-dir="-1" aria-label="Previous image">&lt;</button>
      <button class="slider-btn slider-btn--next" type="button" data-slider-dir="1" aria-label="Next image">&gt;</button>
      <div class="slider-dots" aria-label="Product image selector">
        ${images.map((_, index) => `<button type="button" class="${index === 0 ? "active" : ""}" data-slider-dot="${index}" aria-label="Show image ${index + 1}"></button>`).join("")}
      </div>
    ` : "";
    return `<div class="product-slider" data-slider><div class="product-slides">${slides}</div>${controls}</div>`;
  }

  const initials = product.name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return `<div class="product-fallback"><span>${escapeHtml(initials || "C")}</span></div>`;
}

function marketplaceButtons(productName, className = "marketplace-list") {
  const labels = { ondc: "ONDC", amazon: "Amazon", flipkart: "Flipkart", ajio: "AJIO" };
  return `
    <div class="${className}" aria-label="Marketplace order links for ${escapeHtml(productName)}">
      ${Object.entries(CONFIG.marketplaceOrderLinks).map(([key, url]) => `
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener" data-marketplace="${escapeHtml(key)}">${labels[key] || key}</a>
      `).join("")}
    </div>`;
}

function setSliderIndex(slider, index) {
  const slides = Array.from(slider.querySelectorAll("[data-slide-index]")).filter((slide) => !slide.hidden);
  const dots = Array.from(slider.querySelectorAll("[data-slider-dot]"));
  if (!slides.length) return;
  const activeSlide = slides.find((slide) => Number(slide.dataset.slideIndex) === Number(index)) || slides[((index % slides.length) + slides.length) % slides.length];
  slider.dataset.current = String(Number(activeSlide.dataset.slideIndex) || 0);
  slider.querySelectorAll("[data-slide-index]").forEach((slide) => slide.classList.toggle("active", slide === activeSlide));
  dots.forEach((dot) => dot.classList.toggle("active", Number(dot.dataset.sliderDot) === Number(activeSlide.dataset.slideIndex)));
}

function stepSlider(slider, direction) {
  const slides = Array.from(slider.querySelectorAll("[data-slide-index]")).filter((slide) => !slide.hidden);
  if (!slides.length) return;
  const current = slides.findIndex((slide) => Number(slide.dataset.slideIndex) === Number(slider.dataset.current));
  const next = slides[((current + direction) % slides.length + slides.length) % slides.length];
  setSliderIndex(slider, Number(next.dataset.slideIndex) || 0);
}

function handleProductImageError(image) {
  const slider = image.closest("[data-slider]");
  if (!slider) {
    image.hidden = true;
    return;
  }
  image.hidden = true;
  const dot = slider.querySelector(`[data-slider-dot="${image.dataset.slideIndex}"]`);
  if (dot) dot.hidden = true;
  const visibleSlides = Array.from(slider.querySelectorAll("[data-slide-index]")).filter((slide) => !slide.hidden);
  if (!visibleSlides.length) {
    slider.innerHTML = `<div class="product-fallback"><span>C</span></div>`;
    return;
  }
  if (image.classList.contains("active")) {
    setSliderIndex(slider, Number(visibleSlides[0].dataset.slideIndex) || 0);
  }
}

function initProductSliders(scope = document) {
  scope.querySelectorAll("[data-slider]").forEach((slider) => {
    slider.dataset.current = slider.dataset.current || "0";
    slider.querySelectorAll("[data-slide-index]").forEach((image) => {
      if (image.complete && image.naturalWidth === 0) handleProductImageError(image);
      image.addEventListener("error", () => handleProductImageError(image));
    });
    slider.querySelectorAll("[data-slider-dir]").forEach((button) => {
      button.addEventListener("click", () => stepSlider(slider, Number(button.dataset.sliderDir)));
    });
    slider.querySelectorAll("[data-slider-dot]").forEach((button) => {
      button.addEventListener("click", () => setSliderIndex(slider, Number(button.dataset.sliderDot)));
    });
  });
}

function ratingText(rating) {
  const count = Math.max(1, Math.min(5, Number(rating) || 5));
  return `${count}/5`;
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  const activeProducts = catalog.filter((product) => product.active);
  if (!activeProducts.length) {
    grid.innerHTML = `<p class="empty-cart">No active SKUs are available right now.</p>`;
    return;
  }

  grid.innerHTML = activeProducts.map((product) => {
    const variant = product.variants?.[0];
    return `
      <article class="product-card product-card--${escapeHtml(product.id || "crunchh")}">
        <div class="product-media">${productImageHtml(product)}</div>
        <div class="product-body">
          <div class="product-meta-line">
            <span class="product-tag">${escapeHtml(product.tagline)}</span>
            <span class="product-stock">${variant ? escapeHtml(packetLabel(variant)) : "Marketplace"}</span>
          </div>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.desc)}</p>
          <div class="product-buy-row">
            <div><small>MRP</small><strong>${variant ? money(variant.price) : "See marketplace"}</strong></div>
            <span>Order, payment, tracking, and history continue on the marketplace you choose.</span>
          </div>
          ${marketplaceButtons(product.name)}
        </div>
      </article>`;
  }).join("");
  initProductSliders(grid);
}

function renderReviews() {
  const grid = document.getElementById("reviewGrid");
  if (!grid) return;
  const activeReviews = reviews.filter((review) => review.active !== false);
  if (!activeReviews.length) {
    grid.innerHTML = `<p class="empty-cart">Customer reviews will appear here soon.</p>`;
    return;
  }
  grid.innerHTML = activeReviews
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    .map((review) => `
      <article class="review-card">
        ${review.screenshotUrl ? `<div class="review-shot"><img src="${escapeHtml(review.screenshotUrl)}" alt="${escapeHtml(review.customerName)} review screenshot" loading="lazy" decoding="async"></div>` : ""}
        <div class="review-body">
          <span>${escapeHtml(ratingText(review.rating))} rating</span>
          <strong>${escapeHtml(review.customerName)}</strong>
          ${review.quote ? `<p>${escapeHtml(review.quote)}</p>` : ""}
        </div>
      </article>`)
    .join("");
}

function renderGiftCombos() {
  const grid = document.getElementById("giftComboGrid");
  if (!grid) return;
  grid.innerHTML = GIFT_COMBOS.map((combo) => `
    <article class="gift-card">
      <span>${escapeHtml(combo.packs)}</span>
      <h3>${escapeHtml(combo.name)}</h3>
      <p>${escapeHtml(combo.detail)}</p>
      <strong>${escapeHtml(combo.price)}</strong>
      <a class="btn primary" href="${giftWhatsappLink(combo)}" target="_blank" rel="noopener">Order on WhatsApp</a>
    </article>
  `).join("");
}

function whatsappLink(message) {
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function checkedValues(form, name) {
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function giftWhatsappLink(combo) {
  const message = [
    "Hi CRUNCHH, I want to order a gifting combo.",
    "",
    `Combo: ${combo.name}`,
    `Pack plan: ${combo.packs}`,
    "",
    "Delivery details:",
    "Name:",
    "Mobile:",
    "Address:",
    "City / PIN:",
    "Preferred delivery date:",
    "",
    "Gift note:",
  ].join("\n");
  return whatsappLink(message);
}

function initBulkOrderForm() {
  const form = document.getElementById("bulkOrderForm");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const products = checkedValues(form, "bulkProducts");
    const message = [
      "Hi CRUNCHH, I want to place a bulk order.",
      "",
      `Name: ${document.getElementById("bulkName").value.trim()}`,
      `Phone: ${document.getElementById("bulkPhone").value.trim()}`,
      `Email: ${document.getElementById("bulkEmail").value.trim()}`,
      `Quantity / packs: ${document.getElementById("bulkQuantity").value.trim()}`,
      `Products: ${products.length ? products.join(", ") : "Assorted"}`,
      `City / delivery location: ${document.getElementById("bulkCity").value.trim()}`,
      `Required by: ${document.getElementById("bulkDate").value.trim() || "Flexible"}`,
      "",
      "Message:",
      document.getElementById("bulkMessage").value.trim() || "Please share pricing and availability.",
    ].join("\n");
    window.open(whatsappLink(message), "_blank", "noopener");
  });
}

function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const enquiry = [
      "Hi CRUNCHH, I want to connect with you.",
      "",
      `Enquiry type: ${document.getElementById("enquiryType").value.trim()}`,
      `Name: ${document.getElementById("enquiryName").value.trim()}`,
      `Phone: ${document.getElementById("enquiryPhone").value.trim()}`,
      `Email: ${document.getElementById("enquiryEmail").value.trim()}`,
      "",
      "Message:",
      document.getElementById("enquiryMessage").value.trim(),
    ].join("\n");
    window.open(whatsappLink(enquiry), "_blank", "noopener");
  });
}

function initNav() {
  const menuBtn = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");
  if (!menuBtn || !navLinks) return;
  menuBtn.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(isOpen));
  });
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });
}

function initWhatsappLinks() {
  const greeting = whatsappLink("Hi CRUNCHH, I want to know more about your healthy snacks.");
  ["footerWhatsapp", "floatWhatsapp"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = greeting;
  });
  document.querySelectorAll("[data-marketplace-links]").forEach((el) => {
    el.innerHTML = marketplaceButtons("CRUNCHH", "marketplace-list marketplace-list--wide");
  });
}

function initStaticImageFallbacks() {
  document.querySelectorAll("img[data-fallback-src]").forEach((image) => {
    image.addEventListener("error", () => {
      const fallback = image.dataset.fallbackSrc;
      if (!fallback || image.src.endsWith(fallback)) return;
      image.src = fallback;
    }, { once: true });
  });
}

function initScrollReveal() {
  const sections = document.querySelectorAll(".shop-section, .gifting-section, .bulk-section, .about-section, .contact-section, .reviews-section");
  if (!sections.length) return;
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sections.forEach((section) => section.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.16 });
  sections.forEach((section) => observer.observe(section));
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${CONFIG.apiBase}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Request failed. Please try again.");
  return data;
}

async function loadCatalogFromServer() {
  try {
    const data = await apiJson("/api/products");
    if (!Array.isArray(data.products) || !data.products.length) return false;
    const productCopy = {
      "stick-crunchh": ["Signature heat", "Sharp masala, crisp soya, finished for a clean savoury snap."],
      "lotus-crunchh": ["Soft cream. Quiet crunch.", "Airy makhana with a polished cream and onion finish."],
      "ruby-crunchh": ["Ruby crisp", "Earthy beetroot, lightly sweet, cut into a vivid crisp bite."],
      "leafy-crunchh": ["Fresh green snap", "Palak crunch lifted with cool spearmint pudina."],
      "fusion-crunchh": ["The house edit", "A curated mix of colours, textures, and CRUNCHH signatures."],
      "puff-crunchh": ["Featherlight fire", "Puffed rice and crisps with a bright chilli lift."],
    };
    catalog = normalizeCatalog(data.products.map((product) => ({
      id: product.slug,
      name: product.name,
      category: product.category,
      flavour: product.flavour,
      tagline: product.tagline || productCopy[product.slug]?.[0] || product.flavour,
      desc: product.description || productCopy[product.slug]?.[1] || `${product.category}. ${product.weightGrams}g. Crisp, balanced, ready to serve.`,
      images: product.imageUrls?.length ? product.imageUrls : [product.imageUrl, `assets/img/optimized/${product.slug}.jpg`, `assets/img/optimized/${product.slug}2.jpg`].filter(Boolean),
      active: product.active,
      variants: [{ id: "packet-80g", grams: product.weightGrams, price: product.pricePaise / 100 }],
    })));
    return true;
  } catch (_error) {
    return false;
  }
}

async function loadReviewsFromServer() {
  try {
    const data = await apiJson("/api/reviews");
    if (!Array.isArray(data.reviews)) return false;
    reviews = data.reviews;
    return true;
  } catch (_error) {
    return false;
  }
}

async function initApp() {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
  renderProducts();
  renderReviews();
  renderGiftCombos();
  initNav();
  initWhatsappLinks();
  initStaticImageFallbacks();
  initBulkOrderForm();
  initContactForm();
  initScrollReveal();
  loadCatalogFromServer().then((updated) => {
    if (updated) renderProducts();
  });
  loadReviewsFromServer().then((updated) => {
    if (updated) renderReviews();
  });
}

initApp().catch((error) => {
  console.error("CRUNCHH storefront failed to start", error);
  renderProducts();
});
