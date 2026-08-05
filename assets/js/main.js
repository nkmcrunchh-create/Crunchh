const CONFIG = {
  whatsappNumber: "917303033324",
  currency: "Rs.",
  company: "Trishul Group",
  cartKey: "crunchh_cart_v4",
  apiBase: "",
};

const DEFAULT_CATALOG = [
  {
    id: "stick-crunchh",
    name: "Stick Crunchh",
    category: "Soya Sticks",
    flavour: "Chatpata Magic",
    tagline: "Signature heat",
    desc: "Sharp masala, crisp soya, finished for a clean savoury snap.",
    images: ["assets/img/stick-crunchh.png", "assets/img/stick-crunchh2.png"],
    active: true,
    variants: [
      { id: "packet-80g", grams: 80, price: 149 },
    ],
  },
  {
    id: "lotus-crunchh",
    name: "Lotus Crunchh",
    category: "Makhana Chips",
    flavour: "Cream & Onion",
    tagline: "Soft cream. Quiet crunch.",
    desc: "Airy makhana with a polished cream and onion finish.",
    images: ["assets/img/lotus-crunchh.png", "assets/img/lotus-crunchh2.png"],
    active: true,
    variants: [
      { id: "packet-80g", grams: 80, price: 175 },
    ],
  },
  {
    id: "ruby-crunchh",
    name: "Ruby Crunchh",
    category: "Beetroot Chips",
    flavour: "Earthy & Sweet",
    tagline: "Ruby crisp",
    desc: "Earthy beetroot, lightly sweet, cut into a vivid crisp bite.",
    images: ["assets/img/ruby-crunchh.png", "assets/img/ruby-crunchh2.png"],
    active: true,
    variants: [
      { id: "packet-80g", grams: 80, price: 159 },
    ],
  },
  {
    id: "leafy-crunchh",
    name: "Leafy Crunchh",
    category: "Palak Chips",
    flavour: "Spearmint Pudina",
    tagline: "Fresh green snap",
    desc: "Palak crunch lifted with cool spearmint pudina.",
    images: ["assets/img/leafy-crunchh.png", "assets/img/leafy-crunchh2.png"],
    active: true,
    variants: [
      { id: "packet-80g", grams: 80, price: 159 },
    ],
  },
  {
    id: "fusion-crunchh",
    name: "Fusion Crunchh",
    category: "Assorted Chips",
    flavour: "Rainbow Mix",
    tagline: "The house edit",
    desc: "A curated mix of colours, textures, and CRUNCHH signatures.",
    images: ["assets/img/fusion-crunchh.png", "assets/img/fusion-crunchh2.png"],
    active: true,
    variants: [
      { id: "packet-80g", grams: 80, price: 159 },
    ],
  },
  {
    id: "puff-crunchh",
    name: "Puff Crunchh",
    category: "Puffed Rice & Crisps",
    flavour: "Theekhi Chilli",
    tagline: "Featherlight fire",
    desc: "Puffed rice and crisps with a bright chilli lift.",
    images: ["assets/img/puff-crunchh.png", "assets/img/puff-crunchh2.png"],
    active: true,
    variants: [
      { id: "packet-80g", grams: 80, price: 139 },
    ],
  },
];

let catalog = normalizeCatalog(DEFAULT_CATALOG);
let cart = readJson(CONFIG.cartKey, {});

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : cloneCatalog(fallback);
  } catch (error) {
    return cloneCatalog(fallback);
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cloneCatalog(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeCatalog(items) {
  return cloneCatalog(items).map((product) => {
    const images = Array.isArray(product.images)
      ? product.images
      : [product.image].filter(Boolean);
    const variants = Array.isArray(product.variants) && product.variants.length
      ? product.variants
      : Object.entries(product.prices || {}).map(([, price], index) => ({
          id: `packet-${index + 1}`,
          grams: index === 0 ? 25 : 120,
          price,
        }));

    return {
      ...product,
      active: product.active !== false,
      image: images[0] || "",
      images: images.map((image) => String(image || "").trim()).filter(Boolean),
      inventoryQuantity: Number.isFinite(Number(product.inventoryQuantity)) ? Number(product.inventoryQuantity) : null,
      variants: variants.map((variant, index) => ({
        id: variant.id || `packet-${index + 1}-${Date.now().toString(36)}`,
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

function slugify(value) {
  const base = String(value || "new-sku")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "new-sku"}-${Date.now().toString(36)}`;
}

function money(value) {
  const amount = Number(value) || 0;
  return `${CONFIG.currency} ${amount.toLocaleString("en-IN")}`;
}

function getProduct(productId) {
  return catalog.find((item) => item.id === productId);
}

function getCartKey(productId, sizeId) {
  return `${productId}:${sizeId}`;
}

function packetLabel(variant) {
  return `${Number(variant.grams) || 0}g Packet`;
}

function getCartEntries() {
  return Object.entries(cart)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([key, qty]) => {
      const [productId, sizeId] = key.split(":");
      const product = getProduct(productId);
      if (!product) return null;
      const variant = product.variants?.find((item) => item.id === sizeId);
      if (!variant) return null;
      const price = Number(variant.price) || 0;
      return {
        key,
        product,
        sizeId,
        sizeLabel: packetLabel(variant),
        qty: Number(qty),
        price,
        lineTotal: price * Number(qty),
      };
    })
    .filter(Boolean);
}

function cartTotal() {
  return getCartEntries().reduce((sum, item) => sum + item.lineTotal, 0);
}

function cartCount() {
  return getCartEntries().reduce((sum, item) => sum + item.qty, 0);
}

function productImages(product) {
  const images = Array.isArray(product.images) && product.images.length
    ? product.images
    : [product.image].filter(Boolean);
  return images.map((image) => String(image || "").trim()).filter(Boolean);
}

function productImageHtml(product) {
  const images = productImages(product);

  if (images.length) {
    const slides = images.map((image, index) => `
      <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)} image ${index + 1}" class="${index === 0 ? "active" : ""}" data-slide-index="${index}">
    `).join("");
    const controls = images.length > 1 ? `
      <button class="slider-btn slider-btn--prev" type="button" data-slider-dir="-1" aria-label="Previous image">‹</button>
      <button class="slider-btn slider-btn--next" type="button" data-slider-dir="1" aria-label="Next image">›</button>
      <div class="slider-dots" aria-label="Product image selector">
        ${images.map((_, index) => `<button type="button" class="${index === 0 ? "active" : ""}" data-slider-dot="${index}" aria-label="Show image ${index + 1}"></button>`).join("")}
      </div>
    ` : "";

    return `
      <div class="product-slider" data-slider>
        <div class="product-slides">${slides}</div>
        ${controls}
      </div>`;
  }

  const initials = product.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return `<div class="product-fallback"><span>${escapeHtml(initials || "C")}</span></div>`;
}

function setSliderIndex(slider, index) {
  const slides = Array.from(slider.querySelectorAll("[data-slide-index]"));
  const dots = Array.from(slider.querySelectorAll("[data-slider-dot]"));
  if (!slides.length) return;

  const nextIndex = (index + slides.length) % slides.length;
  slider.dataset.current = String(nextIndex);
  slides.forEach((slide, i) => slide.classList.toggle("active", i === nextIndex));
  dots.forEach((dot, i) => dot.classList.toggle("active", i === nextIndex));
}

function initProductSliders(scope = document) {
  scope.querySelectorAll("[data-slider]").forEach((slider) => {
    slider.dataset.current = slider.dataset.current || "0";
    slider.querySelectorAll("[data-slider-dir]").forEach((button) => {
      button.addEventListener("click", () => {
        const current = Number(slider.dataset.current) || 0;
        setSliderIndex(slider, current + Number(button.dataset.sliderDir));
      });
    });
    slider.querySelectorAll("[data-slider-dot]").forEach((button) => {
      button.addEventListener("click", () => {
        setSliderIndex(slider, Number(button.dataset.sliderDot));
      });
    });
  });
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  const activeProducts = catalog.filter((product) => product.active);

  if (!activeProducts.length) {
    grid.innerHTML = `<p class="empty-cart">No active SKUs are available right now.</p>`;
    return;
  }

  grid.innerHTML = activeProducts
    .map((product) => {
      const stockLine = product.inventoryQuantity == null
        ? "In stock"
        : product.inventoryQuantity > 0
          ? `${product.inventoryQuantity} packs ready`
          : "Sold out";
      const variants = (product.variants || [])
        .map((variant) => {
          const price = Number(variant.price) || 0;
          if (price <= 0) return "";
          return `
            <div class="variant-row">
              <div>
                <small>${escapeHtml(packetLabel(variant))}</small>
                <strong>${money(price)}</strong>
              </div>
              <button class="add-btn" type="button" data-product="${escapeHtml(product.id)}" data-size="${escapeHtml(variant.id)}" ${product.inventoryQuantity === 0 ? "disabled" : ""}>Add to cart</button>
            </div>`;
        })
        .join("");

      return `
        <article class="product-card">
          <div class="product-media">${productImageHtml(product)}</div>
          <div class="product-body">
            <div class="product-meta-line">
              <span class="product-tag">${escapeHtml(product.tagline)}</span>
              <span class="product-stock">${escapeHtml(stockLine)}</span>
            </div>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.desc)}</p>
            <div class="variant-list">${variants}</div>
          </div>
        </article>`;
    })
    .join("");

  grid.querySelectorAll(".add-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const product = getProduct(button.dataset.product);
      const variant = product?.variants?.find((item) => item.id === button.dataset.size);
      const sizeLabel = variant ? packetLabel(variant) : "Packet";
      addToCart(button.dataset.product, button.dataset.size);
      button.textContent = "Added";
      button.classList.add("added");
      showCartToast(`${product?.name || "Product"} ${sizeLabel} added`);
      setTimeout(() => {
        button.textContent = "Add to cart";
        button.classList.remove("added");
      }, 900);
    });
  });

  initProductSliders(grid);
}

function addToCart(productId, sizeId) {
  const key = getCartKey(productId, sizeId);
  cart[key] = (Number(cart[key]) || 0) + 1;
  persistAndRenderCart();
}

function setCartQty(key, qty) {
  cart[key] = Math.max(0, Number(qty) || 0);
  if (cart[key] === 0) delete cart[key];
  persistAndRenderCart();
}

function persistAndRenderCart() {
  writeJson(CONFIG.cartKey, cart);
  renderCart();
}

function renderCart() {
  const list = document.getElementById("cartList");
  const entries = getCartEntries();
  const count = cartCount();
  const total = cartTotal();
  const headerCart = document.querySelector(".cart-pill");
  document.getElementById("cartCount").textContent = count;
  if (headerCart) headerCart.hidden = count === 0;
  document.getElementById("cartTotal").textContent = money(total);
  renderStickyCart(count, total);

  if (!entries.length) {
    list.innerHTML = `<p class="empty-cart">Your cart is empty. Add a pack from the shop section to begin.</p>`;
    return;
  }

  list.innerHTML = entries
    .map((item) => `
      <div class="cart-item">
        <div>
          <div class="cart-item-title">${escapeHtml(item.product.name)}</div>
          <div class="cart-item-meta">${escapeHtml(item.sizeLabel)} x ${item.qty} = ${money(item.lineTotal)}</div>
        </div>
        <div class="stepper" aria-label="Quantity controls">
          <button type="button" data-key="${escapeHtml(item.key)}" data-delta="-1" aria-label="Remove one">-</button>
          <span>${item.qty}</span>
          <button type="button" data-key="${escapeHtml(item.key)}" data-delta="1" aria-label="Add one">+</button>
        </div>
      </div>`)
    .join("");

  list.querySelectorAll(".stepper button").forEach((button) => {
    button.addEventListener("click", () => {
      const nextQty = (Number(cart[button.dataset.key]) || 0) + Number(button.dataset.delta);
      setCartQty(button.dataset.key, nextQty);
    });
  });
}

function renderStickyCart(count, total) {
  const stickyCart = document.getElementById("stickyCart");
  const stickyCartCount = document.getElementById("stickyCartCount");
  const stickyCartTotal = document.getElementById("stickyCartTotal");
  if (!stickyCart || !stickyCartCount || !stickyCartTotal) return;

  stickyCart.hidden = count === 0;
  stickyCartCount.textContent = `${count} ${count === 1 ? "item" : "items"} in cart`;
  stickyCartTotal.textContent = money(total);
}

function openCheckout(focusAddress = true) {
  const section = document.getElementById("order");
  if (!section) return;
  section.classList.remove("checkout-collapsed");
  section.setAttribute("aria-hidden", "false");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  if (focusAddress) {
    window.setTimeout(() => {
      const firstField = document.getElementById("customerName");
      if (firstField) firstField.focus({ preventScroll: true });
    }, 350);
  }
}

function initCheckoutOpeners() {
  document.querySelectorAll("[data-open-checkout]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openCheckout();
    });
  });
}

let toastTimer;

function showCartToast(message) {
  const toast = document.getElementById("cartToast");
  const toastText = document.getElementById("toastText");
  if (!toast || !toastText) return;

  toastText.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function getCustomerFromForm() {
  return {
    name: document.getElementById("customerName").value.trim(),
    mobile: document.getElementById("customerPhone").value.trim(),
    email: document.getElementById("customerEmail").value.trim(),
    whatsappOptIn: document.getElementById("whatsappConsent").checked,
  };
}

function getAddressFromForm() {
  return {
    line1: document.getElementById("addressLine1").value.trim(),
    line2: document.getElementById("addressLine2").value.trim() || null,
    landmark: document.getElementById("customerLandmark").value.trim() || null,
    city: document.getElementById("customerCity").value.trim(),
    state: document.getElementById("customerState").value.trim(),
    postalCode: document.getElementById("customerPincode").value.trim(),
    country: "IN",
    addressType: "SHIPPING",
  };
}

function getCheckoutPayload() {
  const entries = getCartEntries();
  return {
    customer: getCustomerFromForm(),
    shippingAddress: getAddressFromForm(),
    cartItems: entries.map((item) => ({
      productId: item.product.id,
      quantity: item.qty,
      claimedUnitPricePaise: Math.round(item.price * 100),
    })),
    paymentMethod: document.getElementById("paymentMethod").value,
    couponCode: null,
    notes: document.getElementById("orderNotes").value.trim(),
  };
}

function whatsappLink(message) {
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function moneyPaise(value) {
  return `${CONFIG.currency} ${((Number(value) || 0) / 100).toLocaleString("en-IN")}`;
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${CONFIG.apiBase}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "Request failed. Please try again.");
  }
  return data;
}

function setOrderBusy(isBusy) {
  const button = document.getElementById("placeOrderBtn");
  if (!button) return;
  button.disabled = isBusy;
  if (isBusy) {
    button.textContent = "Processing...";
    return;
  }
  updatePaymentButton();
}

function updatePaymentButton() {
  const button = document.getElementById("placeOrderBtn");
  const paymentMethod = document.getElementById("paymentMethod");
  if (!button || !paymentMethod) return;
  button.textContent = paymentMethod.value === "COD" ? "Place COD order" : "Continue to Razorpay";
}

function renderOrderStatus(status, message) {
  const invoiceSection = document.getElementById("invoiceSection");
  const invoiceIntro = document.getElementById("invoiceIntro");
  const invoiceBody = document.getElementById("invoiceBody");
  const invoiceWhatsapp = document.getElementById("invoiceWhatsapp");
  const trackingLink = document.getElementById("trackingLink");
  const invoiceDownload = document.getElementById("invoiceDownload");
  const statusTitle = document.getElementById("statusTitle");

  if (statusTitle) statusTitle.textContent = status.paymentMethod === "COD" ? "COD receipt status" : "Payment and receipt status";
  invoiceIntro.textContent = message || `Order ${status.publicOrderId} is being processed securely.`;
  const stages = status.stages || {};
  invoiceBody.innerHTML = `
    <div><strong>Total</strong><br>${moneyPaise(status.totalPaise || 0)}</div>
    <table class="invoice-table"><tbody>
      <tr><td>Payment received</td><td>${stages.paymentReceived ? "Done" : "Pending"}</td></tr>
      <tr><td>Booking shipment</td><td>${stages.bookingShipment ? "In progress" : stages.shipmentBooked ? "Done" : "Waiting"}</td></tr>
      <tr><td>Shipment booked</td><td>${stages.shipmentBooked ? "Done" : "Pending"}</td></tr>
      <tr><td>Invoice prepared</td><td>${stages.invoicePrepared ? `Done${status.invoiceNumber ? ` (${escapeHtml(status.invoiceNumber)})` : ""}` : "Pending"}</td></tr>
      <tr><td>WhatsApp with tracking sent</td><td>${stages.whatsappConfirmationSent ? "Done" : "Pending"}</td></tr>
    </tbody></table>
    <p class="fine-print">Server status: ${escapeHtml(status.paymentStatus || "")} / ${escapeHtml(status.fulfilmentStatus || "")}</p>`;
  trackingLink.href = `/track/${status.publicOrderId}`;
  if (invoiceDownload) {
    invoiceDownload.hidden = !stages.invoicePrepared;
    invoiceDownload.dataset.publicOrderId = status.publicOrderId || "";
  }
  invoiceWhatsapp.href = whatsappLink(`Hi CRUNCHH, I need help with order ${status.publicOrderId}.`);
  invoiceSection.hidden = false;
  invoiceSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function pollOrderStatus(publicOrderId) {
  const started = Date.now();
  let lastStatus = null;
  while (Date.now() - started < 90000) {
    lastStatus = await apiJson(`/api/orders/${encodeURIComponent(publicOrderId)}/status`);
    renderOrderStatus(lastStatus, "Verifying your payment and preparing fulfilment...");
    if (lastStatus.stages?.whatsappConfirmationSent || lastStatus.fulfilmentStatus === "SHIPMENT_BOOKED") return lastStatus;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  renderOrderStatus(lastStatus || { publicOrderId }, "Your payment has been received. Shipment booking is being processed. You can safely close this page.");
  return lastStatus;
}

async function loadRazorpayCheckout() {
  if (window.Razorpay) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function handlePrepaidPayment(order) {
  const razorpayOrder = await apiJson("/api/payments/razorpay/order", {
    method: "POST",
    body: JSON.stringify({ publicOrderId: order.publicOrderId }),
  });

  if (razorpayOrder.key === "rzp_test_mock") {
    await apiJson("/api/dev/mock-razorpay/capture", {
      method: "POST",
      body: JSON.stringify({ publicOrderId: order.publicOrderId }),
    });
    return pollOrderStatus(order.publicOrderId);
  }

  await loadRazorpayCheckout();
  renderOrderStatus({ ...order, stages: {} }, "Verifying your payment...");
  await new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: razorpayOrder.key,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      name: razorpayOrder.name,
      description: razorpayOrder.description,
      order_id: razorpayOrder.orderId,
      prefill: razorpayOrder.prefill,
      handler: async (response) => {
        try {
          await apiJson("/api/payments/razorpay/verify", {
            method: "POST",
            body: JSON.stringify({ ...response, publicOrderId: order.publicOrderId }),
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      modal: { ondismiss: () => reject(new Error("Payment was closed before completion.")) },
    });
    checkout.open();
  });
  return pollOrderStatus(order.publicOrderId);
}

function initOrderForm() {
  const form = document.getElementById("orderForm");
  updatePaymentButton();
  document.getElementById("paymentMethod").addEventListener("change", updatePaymentButton);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const entries = getCartEntries();
    if (!entries.length) {
      alert("Please add at least one Crunchh product to your cart.");
      document.getElementById("shop").scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setOrderBusy(true);
    try {
      const payload = getCheckoutPayload();
      payload.customerNote = payload.notes;
      delete payload.notes;
      const order = await apiJson("/api/checkout/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      renderOrderStatus(
        { ...order, stages: {} },
        order.paymentMethod === "COD"
          ? "COD order received. Booking shipment, invoice, and WhatsApp tracking details..."
          : "Address confirmed. Opening Razorpay payment..."
      );
      if (order.paymentMethod === "PREPAID") {
        await handlePrepaidPayment(order);
      } else {
        await pollOrderStatus(order.publicOrderId);
      }
      cart = {};
      persistAndRenderCart();
    } catch (error) {
      alert(error.message || "Checkout failed. Please try again.");
    } finally {
      setOrderBusy(false);
    }
  });

  document.getElementById("clearCart").addEventListener("click", () => {
    cart = {};
    persistAndRenderCart();
  });

  const pincode = document.getElementById("customerPincode");
  pincode.addEventListener("blur", async () => {
    if (!/^\d{6}$/.test(pincode.value.trim())) return;
    try {
      await apiJson("/api/shipping/serviceability", {
        method: "POST",
        body: JSON.stringify({ postalCode: pincode.value.trim(), paymentMethod: document.getElementById("paymentMethod").value }),
      });
    } catch (error) {
      alert(error.message);
    }
  });

  const invoiceDownload = document.getElementById("invoiceDownload");
  if (invoiceDownload) {
    invoiceDownload.addEventListener("click", async (event) => {
      event.preventDefault();
      const publicOrderId = invoiceDownload.dataset.publicOrderId;
      const mobile = document.getElementById("customerPhone").value.trim();
      if (!publicOrderId) return;
      if (!mobile) {
        alert("Enter the order mobile number to download the invoice.");
        return;
      }
      try {
        const invoice = await apiJson(`/api/orders/${encodeURIComponent(publicOrderId)}/invoice?mobile=${encodeURIComponent(mobile)}`);
        window.open(invoice.url, "_blank", "noopener");
      } catch (error) {
        alert(error.message || "Invoice is not ready yet.");
      }
    });
  }
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

    const name = document.getElementById("enquiryName").value.trim();
    const phone = document.getElementById("enquiryPhone").value.trim();
    const email = document.getElementById("enquiryEmail").value.trim();
    const type = document.getElementById("enquiryType").value.trim();
    const message = document.getElementById("enquiryMessage").value.trim();

    const enquiry = [
      "Hi Crunchh, I want to connect with you.",
      "",
      `Enquiry type: ${type}`,
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      "",
      "Message:",
      message,
    ].join("\n");

    window.open(whatsappLink(enquiry), "_blank", "noopener");
  });
}

function initNav() {
  const menuBtn = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");
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
  const greeting = whatsappLink("Hi Crunchh, I want to know more about your healthy snacks.");
  ["footerWhatsapp", "floatWhatsapp"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = greeting;
  });
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
      tagline: productCopy[product.slug]?.[0] || product.flavour,
      desc: productCopy[product.slug]?.[1] || `${product.category}. ${product.weightGrams}g. Crisp, balanced, ready to serve.`,
      images: [
        product.imageUrl,
        product.imageUrl ? product.imageUrl.replace(".png", "2.png") : "",
      ].filter(Boolean),
      active: product.active,
      inventoryQuantity: product.inventoryQuantity,
      variants: [{ id: "packet-80g", grams: product.weightGrams, price: product.pricePaise / 100 }],
    })));
    return true;
  } catch (_error) {
    // Static fallback keeps the storefront browsable before the backend is started.
    return false;
  }
}

async function initApp() {
  document.getElementById("year").textContent = new Date().getFullYear();
  renderProducts();
  renderCart();
  initOrderForm();
  initCheckoutOpeners();
  initContactForm();
  initNav();
  initWhatsappLinks();
  loadCatalogFromServer().then((updated) => {
    if (updated) {
      renderProducts();
      renderCart();
    }
  });
}

initApp();
