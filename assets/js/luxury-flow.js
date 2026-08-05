(() => {
  const copy = {
    "Stick Crunchh": ["Signature heat", "Sharp masala, crisp soya, finished for a clean savoury snap."],
    "Lotus Crunchh": ["Soft cream. Quiet crunch.", "Airy makhana with a polished cream and onion finish."],
    "Ruby Crunchh": ["Ruby crisp", "Earthy beetroot, lightly sweet, cut into a vivid crisp bite."],
    "Leafy Crunchh": ["Fresh green snap", "Palak crunch lifted with cool spearmint pudina."],
    "Fusion Crunchh": ["The house edit", "A curated mix of colours, textures, and CRUNCHH signatures."],
    "Puff Crunchh": ["Featherlight fire", "Puffed rice and crisps with a bright chilli lift."]
  };

  function cartCount() {
    try {
      const cart = JSON.parse(localStorage.getItem("crunchh_cart_v4") || "{}");
      return Object.values(cart).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    } catch {
      return 0;
    }
  }

  function syncCartEntry() {
    const headerCart = document.querySelector(".cart-pill");
    if (headerCart) headerCart.hidden = cartCount() === 0;
  }

  function refineProducts() {
    document.querySelectorAll(".product-card").forEach((card) => {
      const name = card.querySelector(".product-body h3")?.textContent?.trim();
      const details = name ? copy[name] : null;
      if (!details) return;
      const tag = card.querySelector(".product-tag");
      const body = card.querySelector(".product-body p");
      if (tag) tag.textContent = details[0];
      if (body) body.textContent = details[1];
    });
  }

  function boot() {
    syncCartEntry();
    refineProducts();
    document.addEventListener("click", () => window.setTimeout(() => {
      syncCartEntry();
      refineProducts();
    }, 60));
    new MutationObserver(() => {
      syncCartEntry();
      refineProducts();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
