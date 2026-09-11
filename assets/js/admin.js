const state = {
  dashboard: null,
  orders: [],
  products: [],
  reviews: [],
};

function moneyPaise(value) {
  return `Rs. ${((Number(value) || 0) / 100).toLocaleString("en-IN")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function json(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Request failed");
  return data;
}

function showDashboard() {
  document.getElementById("loginPanel").hidden = true;
  document.getElementById("dashboard").hidden = false;
}

function showLogin() {
  document.getElementById("loginPanel").hidden = false;
  document.getElementById("dashboard").hidden = true;
}

function metric(label, value, detail = "") {
  return `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></div>`;
}

function renderMetrics(summary) {
  document.getElementById("metrics").innerHTML = [
    metric("Revenue", summary.revenueFormatted, `${summary.paidOrders} paid/confirmed orders`),
    metric("Month revenue", summary.monthRevenueFormatted, `${summary.monthOrders} orders this month`),
    metric("Average order", summary.averageOrderValueFormatted, "Paid and confirmed orders"),
    metric("Today orders", String(summary.todayOrders), `${summary.totalOrders} total orders`),
    metric("Pending shipment", String(summary.pendingShipment), "Needs booking or retry"),
    metric("Pending invoice", String(summary.pendingInvoice), "AWB exists, invoice missing"),
    metric("WhatsApp failed", String(summary.whatsappFailed), "Retry from order row"),
    metric("Payment mix", `${summary.prepaidOrders} / ${summary.codOrders}`, "Prepaid / COD"),
  ].join("");
}

function orderRows(orders) {
  if (!orders.length) return `<p class="empty-cart">No orders found.</p>`;
  return `<table class="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Shipment</th><th>Invoice</th><th>WhatsApp</th><th>Actions</th></tr></thead><tbody>${orders.map((order) => `
    <tr>
      <td><strong>${escapeHtml(order.publicOrderId)}</strong><br><small>${new Date(order.createdAt).toLocaleString("en-IN")}</small></td>
      <td>${escapeHtml(order.customerName || "")}<br><small>${escapeHtml(order.mobile || "")}</small></td>
      <td>${escapeHtml(order.totalFormatted || moneyPaise(order.totalPaise))}</td>
      <td>${escapeHtml(order.paymentMethod)}<br><small>${escapeHtml(order.paymentStatus)}</small></td>
      <td>${escapeHtml(order.fulfilmentStatus)}<br><small>${escapeHtml(order.awb || "No AWB")}</small></td>
      <td>${escapeHtml(order.invoiceNumber || "Pending")}</td>
      <td>${escapeHtml(order.whatsappStatus || "NOT_QUEUED")}</td>
      <td>
        <div class="admin-row-actions">
          <button data-job="shipment" data-id="${escapeHtml(order.publicOrderId)}" title="Retry shipment">Ship</button>
          <button data-job="invoice" data-id="${escapeHtml(order.publicOrderId)}" title="Retry invoice">Invoice</button>
          <button data-job="whatsapp" data-id="${escapeHtml(order.publicOrderId)}" title="Retry WhatsApp">WA</button>
        </div>
      </td>
    </tr>`).join("")}</tbody></table>`;
}

function renderOrders(orders) {
  document.getElementById("recentOrders").innerHTML = orderRows(orders.slice(0, 8));
  document.getElementById("orders").innerHTML = orderRows(orders);
}

function renderInventory(products) {
  document.getElementById("inventory").innerHTML = products.length ? products.map((product) => `
    <form class="admin-edit-card" data-product-row="${escapeHtml(product.slug)}">
      <div class="admin-edit-head">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <small>${escapeHtml(product.slug)} | ${escapeHtml(product.priceFormatted || moneyPaise(product.pricePaise))}</small>
        </div>
        <label class="admin-inline-check"><input data-field="active" type="checkbox" ${product.active ? "checked" : ""}> Live</label>
      </div>
      <div class="admin-form-grid">
        <label>Name<input data-field="name" value="${escapeHtml(product.name)}"></label>
        <label>SKU<input data-field="sku" value="${escapeHtml(product.sku)}"></label>
        <label>Category<input data-field="category" value="${escapeHtml(product.category)}"></label>
        <label>Flavour<input data-field="flavour" value="${escapeHtml(product.flavour)}"></label>
        <label>Weight grams<input data-field="weightGrams" type="number" min="1" step="1" value="${Number(product.weightGrams) || 80}"></label>
        <label>Price paise<input data-field="pricePaise" type="number" min="1" step="1" value="${Number(product.pricePaise)}"></label>
        <label>Stock<input data-field="inventoryQuantity" type="number" min="0" step="1" value="${Number(product.inventoryQuantity)}"></label>
        <label>Tagline<input data-field="tagline" value="${escapeHtml(product.tagline || "")}"></label>
      </div>
      <label>Description<textarea data-field="description" rows="2">${escapeHtml(product.description || "")}</textarea></label>
      <label>Image URLs<textarea data-field="imageUrls" rows="3">${escapeHtml((product.imageUrls || []).join("\n"))}</textarea></label>
      <button data-save-product="${escapeHtml(product.slug)}" type="button">Save product</button>
    </form>`).join("") : `<p class="empty-cart">No products yet.</p>`;
}

function renderReviews(reviews) {
  const root = document.getElementById("reviews");
  if (!root) return;
  root.innerHTML = reviews.length ? reviews.map((review) => `
    <form class="admin-edit-card" data-review-row="${escapeHtml(review.id)}">
      <div class="admin-edit-head">
        <div>
          <strong>${escapeHtml(review.customerName)}</strong>
          <small>${Math.max(1, Math.min(5, Number(review.rating) || 5))}/5 rating | order ${Number(review.sortOrder) || 0}</small>
        </div>
        <label class="admin-inline-check"><input data-field="active" type="checkbox" ${review.active ? "checked" : ""}> Live</label>
      </div>
      <div class="admin-form-grid">
        <label>Customer<input data-field="customerName" value="${escapeHtml(review.customerName)}"></label>
        <label>Rating<input data-field="rating" type="number" min="1" max="5" value="${Number(review.rating) || 5}"></label>
        <label>Sort order<input data-field="sortOrder" type="number" value="${Number(review.sortOrder) || 0}"></label>
        <label>Screenshot URL<input data-field="screenshotUrl" value="${escapeHtml(review.screenshotUrl || "")}"></label>
      </div>
      <label>Quote<textarea data-field="quote" rows="2">${escapeHtml(review.quote || "")}</textarea></label>
      <div class="admin-row-actions">
        <button data-save-review="${escapeHtml(review.id)}" type="button">Save review</button>
        <button data-delete-review="${escapeHtml(review.id)}" type="button">Delete</button>
      </div>
    </form>`).join("") : `<p class="empty-cart">No reviews yet.</p>`;
}

function renderLowStock(items) {
  document.getElementById("lowStock").innerHTML = items.length
    ? items.map((item) => `<div class="admin-log-row"><strong>${escapeHtml(item.name)}</strong><span>${Number(item.inventoryQuantity)} packs left</span></div>`).join("")
    : `<p class="empty-cart">No low-stock products.</p>`;
}

function renderLogs(logs) {
  const renderLog = (items, fields) => items.length ? items.map((item) => `
    <div class="admin-log-row">
      <strong>${escapeHtml(fields.title(item))}</strong>
      <span>${escapeHtml(fields.meta(item))}</span>
      <small>${escapeHtml(fields.time(item))}</small>
    </div>`).join("") : `<p class="empty-cart">No logs yet.</p>`;

  document.getElementById("jobLogs").innerHTML = renderLog(logs.jobs || [], {
    title: (item) => `${item.jobType} | ${item.status}`,
    meta: (item) => item.lastError || item.entityId,
    time: (item) => item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "",
  });
  document.getElementById("webhookLogs").innerHTML = renderLog(logs.webhooks || [], {
    title: (item) => `${item.provider} | ${item.eventType}`,
    meta: (item) => item.processingStatus,
    time: (item) => item.receivedAt ? new Date(item.receivedAt).toLocaleString("en-IN") : "",
  });
  document.getElementById("notificationLogs").innerHTML = renderLog(logs.notifications || [], {
    title: (item) => `${item.channel} | ${item.notificationType}`,
    meta: (item) => `${item.recipient} | ${item.status}`,
    time: (item) => item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "",
  });
}

function renderDashboard(data) {
  state.dashboard = data;
  state.orders = data.recentOrders || [];
  state.products = data.inventory || [];
  state.reviews = data.reviews || [];
  renderMetrics(data.summary);
  renderOrders(data.recentOrders || []);
  renderInventory(data.inventory || []);
  renderReviews(data.reviews || []);
  renderLowStock(data.lowStock || []);
  renderLogs(data.logs || {});
}

async function loadDashboard() {
  const data = await json("/api/admin/dashboard");
  renderDashboard(data);
  const me = await json("/api/admin/me").catch(() => ({ admin: null }));
  document.getElementById("adminIdentity").textContent = me.admin?.email ? `Logged in as ${me.admin.email}` : "";
}

async function loadOrders() {
  const q = document.getElementById("q").value.trim();
  const data = await json(`/api/admin/orders${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  renderOrders(data.orders || []);
}

document.getElementById("login").addEventListener("submit", async (event) => {
  event.preventDefault();
  document.getElementById("loginError").textContent = "";
  try {
    await json("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
      }),
    });
    showDashboard();
    await loadDashboard();
  } catch (error) {
    document.getElementById("loginError").textContent = error.message;
  }
});

document.getElementById("refresh").addEventListener("click", loadDashboard);
document.getElementById("search").addEventListener("click", loadOrders);
document.getElementById("logout").addEventListener("click", async () => {
  await json("/api/admin/logout", { method: "POST", body: "{}" });
  showLogin();
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== `tab-${button.dataset.tab}`;
    });
  });
});

document.addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-job]");
  if (retry) {
    await json(`/api/admin/orders/${retry.dataset.id}/retry/${retry.dataset.job}`, { method: "POST", body: "{}" });
    await loadDashboard();
    return;
  }

  const save = event.target.closest("[data-save-product]");
  if (save) {
    const row = document.querySelector(`[data-product-row="${CSS.escape(save.dataset.saveProduct)}"]`);
    await json(`/api/admin/products/${encodeURIComponent(save.dataset.saveProduct)}`, {
      method: "PATCH",
      body: JSON.stringify({
        sku: row.querySelector('[data-field="sku"]').value.trim(),
        name: row.querySelector('[data-field="name"]').value.trim(),
        category: row.querySelector('[data-field="category"]').value.trim(),
        flavour: row.querySelector('[data-field="flavour"]').value.trim(),
        weightGrams: Number(row.querySelector('[data-field="weightGrams"]').value),
        inventoryQuantity: Number(row.querySelector('[data-field="inventoryQuantity"]').value),
        pricePaise: Number(row.querySelector('[data-field="pricePaise"]').value),
        tagline: row.querySelector('[data-field="tagline"]').value.trim(),
        description: row.querySelector('[data-field="description"]').value.trim(),
        imageUrls: row.querySelector('[data-field="imageUrls"]').value,
        active: row.querySelector('[data-field="active"]').checked,
      }),
    });
    await loadDashboard();
    return;
  }

  const saveReview = event.target.closest("[data-save-review]");
  if (saveReview) {
    const row = document.querySelector(`[data-review-row="${CSS.escape(saveReview.dataset.saveReview)}"]`);
    await json(`/api/admin/reviews/${encodeURIComponent(saveReview.dataset.saveReview)}`, {
      method: "PATCH",
      body: JSON.stringify({
        customerName: row.querySelector('[data-field="customerName"]').value.trim(),
        rating: Number(row.querySelector('[data-field="rating"]').value),
        sortOrder: Number(row.querySelector('[data-field="sortOrder"]').value),
        screenshotUrl: row.querySelector('[data-field="screenshotUrl"]').value.trim(),
        quote: row.querySelector('[data-field="quote"]').value.trim(),
        active: row.querySelector('[data-field="active"]').checked,
      }),
    });
    await loadDashboard();
    return;
  }

  const deleteReview = event.target.closest("[data-delete-review]");
  if (deleteReview) {
    await json(`/api/admin/reviews/${encodeURIComponent(deleteReview.dataset.deleteReview)}`, { method: "DELETE" });
    await loadDashboard();
  }
});

function formPayload(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    data[input.name] = input.checked;
  });
  return data;
}

document.getElementById("newProductForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  payload.weightGrams = Number(payload.weightGrams);
  payload.pricePaise = Number(payload.pricePaise);
  payload.inventoryQuantity = Number(payload.inventoryQuantity);
  await json("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
  event.currentTarget.reset();
  await loadDashboard();
});

document.getElementById("newReviewForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formPayload(event.currentTarget);
  payload.rating = Number(payload.rating);
  payload.sortOrder = Number(payload.sortOrder);
  await json("/api/admin/reviews", { method: "POST", body: JSON.stringify(payload) });
  event.currentTarget.reset();
  await loadDashboard();
});

json("/api/admin/me")
  .then(async () => {
    showDashboard();
    await loadDashboard();
  })
  .catch(showLogin);
