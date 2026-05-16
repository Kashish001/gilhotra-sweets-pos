// src/js/orders.js

let currentOrderItems = [];
let orderFilterDate = new Date().toISOString().split("T")[0];

function rOrders(overrideDate = null) {
  if (overrideDate) orderFilterDate = overrideDate;

  document.getElementById("orders-date-picker").value = orderFilterDate;
  const q = (document.getElementById("o-srch").value || "").toLowerCase();

  const filteredOrders = orders.filter((o) => {
    const matchDate = o.date === orderFilterDate;
    const matchSearch =
      !q ||
      (o.name + (o.village || "") + (o.mobile || "")).toLowerCase().includes(q);
    return matchDate && matchSearch;
  });

  const tb = document.getElementById("otbody");
  if (filteredOrders.length === 0) {
    tb.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--tx-3);">No advance orders booked for this date.</td></tr>`;
    return;
  }

  tb.innerHTML = filteredOrders
    .map((o) => {
      const itemsPreview = (o.items || [])
        .map(
          (x) =>
            `<b>${x.name}</b> <span style="color:var(--tx-3)">x${x.qty}</span>`,
        )
        .join(", ");
      const statusBadge =
        o.status === "Delivered"
          ? "paid"
          : o.status === "Cancelled"
            ? "pending"
            : "partial";

      return `<tr class="cust-row" onclick="openOrderModal('${o.id}')">
            <td>
                <div style="font-weight: bold; color: var(--tx-1);">${o.name} <span style="font-weight:normal; font-size:11px; color:var(--tx-3)">${o.so ? `(S/O ${o.so})` : ""}</span></div>
                <div style="font-size: 11px; color: var(--tx-3);">${o.mobile || "\u2014"} &bull; ${o.village || "\u2014"}</div>
            </td>
            <td style="font-size: 13px; color: var(--tx-2); max-width: 250px; overflow: hidden; text-overflow: ellipsis;">${itemsPreview || "\u2014"}</td>
            <td>
                <div style="font-weight: bold; color: var(--green);">${inr(o.adv)}</div>
                <div style="font-size: 11px; color: var(--tx-3);">${o.mode || "Cash"}</div>
            </td>
            <td style="color: var(--tx-2); font-size: 12px;">${o.rem || "\u2014"}</td>
            <td style="text-align: center;"><span class="bdg bdg-${statusBadge}">${o.status || "Pending"}</span></td>
            <td style="text-align: center;">
                <button class="ibtn" onclick="event.stopPropagation(); openOrderModal('${o.id}')" title="Edit Order">&#9998; Edit</button>
            </td>
        </tr>`;
    })
    .join("");
}

function openOrderModal(id = null) {
  editId = id;
  const o = id ? orders.find((x) => x.id === id) : {};
  document.getElementById("order-title").textContent = id
    ? "Edit Order / Booking"
    : "Book New Order";

  document.getElementById("fo-name").value = o.name || "";
  document.getElementById("fo-so").value = o.so || "";
  document.getElementById("fo-village").value = o.village || "";
  document.getElementById("fo-co").value = o.co || "";
  document.getElementById("fo-mobile").value = o.mobile || "";
  document.getElementById("fo-date").value = o.date || orderFilterDate;
  document.getElementById("fo-adv").value = o.adv !== undefined ? o.adv : "";
  document.getElementById("fo-mode").value = o.mode || "Cash";
  document.getElementById("fo-status").value = o.status || "Pending";
  document.getElementById("fo-rem").value = o.rem || "";

  currentOrderItems =
    o.items && o.items.length > 0
      ? JSON.parse(JSON.stringify(o.items))
      : [{ name: "", qty: 1 }];
  renderOrderItems();

  if (document.getElementById("cust-dropdown-orders")) {
    document.getElementById("cust-dropdown-orders").style.display = "none";
  }

  openOv("ov-order");
}

function renderOrderItems() {
  const c = document.getElementById("order-items-container");
  c.innerHTML = currentOrderItems
    .map(
      (r, i) => `
        <div style="display: flex; gap: 12px; margin-bottom: 8px; align-items: center;">
            <input id="oir-name-${i}" list="item-suggestions" value="${r.name}" placeholder="Item name..." style="flex: 2; padding: 8px; border: 1px solid var(--bd); border-radius: 6px; background: var(--bg-input);" oninput="updOrderIr(${i}, 'name', this.value)">
            <input id="oir-qty-${i}" type="number" step="any" value="${r.qty}" placeholder="Qty" style="width: 80px; padding: 8px; border: 1px solid var(--bd); border-radius: 6px; background: var(--bg-input);" oninput="updOrderIr(${i}, 'qty', this.value)">
            <button class="row-del" onclick="rmOrderIr(${i})" title="Remove Item" style="background: var(--bg-surface); border: 1px solid var(--bd); padding: 8px; border-radius: 6px; cursor: pointer;">&#10006;</button>
        </div>
    `,
    )
    .join("");
}

function addOrderIr() {
  currentOrderItems.push({ name: "", qty: 1 });
  renderOrderItems();
}

function rmOrderIr(i) {
  currentOrderItems.splice(i, 1);
  if (currentOrderItems.length === 0)
    currentOrderItems = [{ name: "", qty: 1 }];
  renderOrderItems();
}

function updOrderIr(i, field, val) {
  currentOrderItems[i][field] = val;
}

// --- NEW: Ledger Integration Autofill ---
function checkExistingCustomerOrders() {
  const v = document.getElementById("fo-name").value.toLowerCase().trim();
  const dd = document.getElementById("cust-dropdown-orders");

  if (!v || v.length < 2) {
    dd.style.display = "none";
    return;
  }

  // 1. Combine BOTH databases so it remembers everyone
  const combinedDb = [...entries, ...orders];

  // 2. Safely search (prevents silent crashes if a name is blank)
  const allMatches = combinedDb.filter((e) =>
    (e.name || "").toLowerCase().includes(v),
  );

  const uniqueCustomers = {};
  allMatches.forEach((e) => {
    const key =
      (e.name || "").toLowerCase().trim() + "|" + (e.mobile || "").trim();
    if (!uniqueCustomers[key]) uniqueCustomers[key] = e;
  });

  currentSuggestions = Object.values(uniqueCustomers).slice(0, 4);

  if (currentSuggestions.length > 0) {
    dd.innerHTML = currentSuggestions
      .map((m, index) => {
        const meta = [m.so ? `S/O ${m.so}` : null, m.village, m.mobile]
          .filter(Boolean)
          .join(" &bull; ");
        return `<div class="autofill-item" onclick="applyCustomerFillOrders(${index})">
                <div class="af-name">${m.name}</div>
                <div class="af-meta">${meta || "No additional details"}</div>
            </div>`;
      })
      .join("");
    dd.style.display = "flex";
  } else {
    dd.style.display = "none";
  }
}

function applyCustomerFillOrders(index) {
  const match = currentSuggestions[index];
  if (!match) return;

  document.getElementById("fo-name").value = match.name || "";
  document.getElementById("fo-so").value = match.so || "";
  document.getElementById("fo-village").value = match.village || "";
  document.getElementById("fo-mobile").value = match.mobile || "";
  document.getElementById("fo-co").value = match.co || "";

  document.getElementById("cust-dropdown-orders").style.display = "none";
}
// ----------------------------------------

async function saveOrder() {
  if (!Auth.checkIsAdmin()) return;

  const name = document.getElementById("fo-name").value.trim();
  if (!name)
    return customAlert("Please provide a Customer Name for this booking.");

  const validItems = currentOrderItems.filter((r) => r.name.trim() !== "");

  const d = {
    name: name,
    so: document.getElementById("fo-so").value.trim(),
    village: document.getElementById("fo-village").value.trim(),
    co: document.getElementById("fo-co").value.trim(),
    mobile: document.getElementById("fo-mobile").value,
    date: document.getElementById("fo-date").value,
    items: validItems,
    adv: parseFloat(document.getElementById("fo-adv").value) || 0,
    mode: document.getElementById("fo-mode").value,
    status: document.getElementById("fo-status").value,
    rem: document.getElementById("fo-rem").value,
  };

  try {
    if (editId) await pb.collection("orders").update(editId, d);
    else await pb.collection("orders").create(d);

    closeOv("ov-order");
    await loadData(true);
    rOrders(document.getElementById("fo-date").value);
  } catch (err) {
    console.error("Save Error:", err);
    customAlert("Failed to save order booking.");
  }
}

// --- NEW: Print Order Receipt ---
function printOrder() {
  if (!editId)
    return customAlert("Please save the order first before printing.");
  const o = orders.find((x) => x.id === editId);
  if (!o) return;

  const timestamp = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let itemRows = (o.items || [])
    .map(
      (it) => `
        <tr>
            <td style="padding: 10px 8px; border-bottom: 1px solid #eee; font-weight: bold;">${it.name}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #eee; text-align: right;">${it.qty}</td>
        </tr>
    `,
    )
    .join("");

  const printHTML = `
    <html>
    <head>
        <title>Order Receipt - ${o.name}</title>
        <style>
            body { font-family: 'Georgia', serif; color: #1a1000; padding: 40px; margin: 0 auto; max-width: 600px; background: #fff; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #bf6020; padding-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-family: sans-serif; font-size: 14px; }
            th { background: #cf6a28; color: #fff; padding: 10px 8px; text-align: left; font-size: 12px; text-transform: uppercase; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 style="color: #bf6020; margin: 0 0 8px 0; font-size: 28px;">${SHOP.name}</h1>
            <div style="color: #555; font-size: 14px;">Advance Order Booking Receipt</div>
            <div style="color: #555; font-size: 12px; margin-top: 4px;">${SHOP.ph ? `Ph: ${SHOP.ph}` : ""}</div>
        </div>

        <div style="display: flex; justify-content: space-between; background: #fdfaf6; padding: 16px; border-radius: 8px; border: 1px solid #e2d5c0; margin-bottom: 24px;">
            <div>
                <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold;">Customer</div>
                <div style="font-size: 16px; font-weight: bold; margin-top: 4px;">${o.name} ${o.so ? `(S/O ${o.so})` : ""}</div>
                <div style="font-size: 14px; color: #555; margin-top: 4px;">${o.mobile || "No Mobile"} &bull; ${o.village || "No Village"}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold;">Delivery Date</div>
                <div style="font-size: 18px; font-weight: bold; color: #bf6020; margin-top: 4px;">${fd(o.date)}</div>
            </div>
        </div>

        <table>
            <thead><tr><th>Item Description</th><th style="text-align: right;">Quantity</th></tr></thead>
            <tbody>${itemRows}</tbody>
        </table>

        <div style="border: 1px solid #e2d5c0; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-family: sans-serif;">
            <div>
                <div style="font-size: 12px; color: #888;">Advance Paid (${o.mode || "Cash"})</div>
                <div style="font-size: 24px; font-weight: bold; color: #256b42;">${inr(o.adv)}</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #555; max-width: 200px;">
                <b>Remarks:</b> ${o.rem || "None"}
            </div>
        </div>

        <div style="text-align: center; color: #777; font-size: 11px; margin-top: 40px; font-family: sans-serif;">
            Printed on ${timestamp} <br> Thank you for your order!
        </div>
    </body>
    </html>`;

  const w = window.open("", "_blank");
  w.document.write(printHTML);
  w.document.close();
  setTimeout(() => w.print(), 250);
}
