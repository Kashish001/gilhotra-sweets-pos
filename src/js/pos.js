// src/js/pos.js

function rPos() {
  const cats = ["All", ...new Set(items.map((i) => i.cat))];
  document.getElementById("pos-cats").innerHTML = cats
    .map(
      (c) =>
        `<div class="cpill${c === posSelCat ? " on" : ""}" onclick="setPosCat('${c}')">${c}</div>`,
    )
    .join("");

  const list =
    posSelCat === "All" ? items : items.filter((i) => i.cat === posSelCat);

  document.getElementById("pos-items-grid").innerHTML = list
    .map((it) => {
      let stockHtml = "";
      let isOut = false;
      if (it.hasStock) {
        isOut = it.stockQty <= 0;
        stockHtml = isOut
          ? `<div style="font-size:11px; color:var(--red); font-weight:bold; margin-top:8px;">Out of Stock</div>`
          : `<div style="font-size:11px; color:var(--green); font-weight:bold; margin-top:8px;">${it.stockQty} ${it.unit} left</div>`;
      }
      return `<div class="icard" style="padding-bottom: 16px; border-bottom: 3px solid var(--accent); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; height: 100%; ${isOut ? "opacity: 0.5; filter: grayscale(100%); pointer-events: none;" : ""}" onclick="addPosItem('${it.id}')">
        <div class="iname" style="font-size: 15px; margin-bottom: 6px; color: var(--tx-1);">${it.name}</div>
        <div class="iprice" style="font-size: 16px;">${inr(it.price)} <span style="font-size: 11px;">/ ${it.unit}</span></div>
        ${stockHtml}
    </div>`;
    })
    .join("");
  rPosCart();
}

function setPosCat(c) {
  posSelCat = c;
  rPos();
}

async function addPosItem(id) {
  const dbItem = items.find((i) => i.id === id);
  if (!dbItem) return;

  let itemPrice = dbItem.price;

  // VARIABLE PRICING LOGIC: If price is 0, ask the user for the price!
  if (itemPrice === 0) {
    const customPrice = await customPrompt(
      `Enter the price for ${dbItem.name} (per ${dbItem.unit}):`,
    );
    if (customPrice === null || customPrice === "") return; // User cancelled
    itemPrice = parseFloat(customPrice) || 0;
  }

  // Look for the item in the cart.
  // We match by BOTH ID and Price so you can ring up a 10rs Kurkure and a 20rs Kurkure in the same bill!
  const existing = posCart.find((i) => i.id === id && i.price === itemPrice);

  // Calculate total quantity of this specific item ID currently in the cart
  const currentCartQty = posCart
    .filter((i) => i.id === id)
    .reduce((sum, i) => sum + i.qty, 0);

  if (dbItem.hasStock && currentCartQty + 1 > dbItem.stockQty) {
    customAlert(
      `Cannot add! Only ${dbItem.stockQty} ${dbItem.unit} available in stock.`,
    );
    return;
  }

  if (existing) {
    existing.qty += 1;
  } else {
    // Add it as a new line item with the custom price
    posCart.push({ ...dbItem, price: itemPrice, qty: 1 });
  }

  rPosCart();
}

function updatePosQty(idx, val) {
  const qty = parseFloat(val);
  if (qty >= 0) posCart[idx].qty = qty;
  rPosCart();
}

function removePosItem(idx) {
  posCart.splice(idx, 1);
  rPosCart();
}

function clearPos() {
  if (
    posCart.length > 0 &&
    !customConfirm("Clear the current Quick Bill cart?")
  )
    return;
  posCart = [];
  document.getElementById("pos-cname").value = "";
  document.getElementById("pos-cphone").value = "";
  document.getElementById("pos-cash-given").value = "";
  rPosCart();
}

function calcPosChange() {
  const total = posCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cash = parseFloat(document.getElementById("pos-cash-given").value) || 0;
  const change = Math.max(0, cash - total);
  document.getElementById("pos-change-due").innerHTML =
    `Change: ${inr(change)}`;
}

function rPosCart() {
  const listEl = document.getElementById("pos-cart-list");
  if (posCart.length === 0) {
    listEl.innerHTML = `<div style="padding: 40px 20px; text-align: center; color: var(--tx-3);">Cart is empty.<br><span style="font-size: 12px; margin-top: 8px; display: inline-block;">Click items on the left to build a bill.</span></div>`;
    document.getElementById("pos-total-amt").innerHTML = inr(0);
    calcPosChange();
    return;
  }
  let total = 0;
  listEl.innerHTML = posCart
    .map((item, idx) => {
      const amt = item.price * item.qty;
      total += amt;
      return `<div class="pos-cart-item">
        <div class="pci-info">
            <div class="pci-name">${item.name}</div>
            <div class="pci-rate">${inr(item.price)} / ${item.unit}</div>
        </div>
        <input class="pci-qty" type="number" step="any" value="${item.qty}" onchange="updatePosQty(${idx}, this.value)" onclick="this.select()">
        <div class="pci-amt">${inr(amt)}</div>
        <button class="pci-del" onclick="removePosItem(${idx})">&#10006;</button>
    </div>`;
    })
    .join("");
  document.getElementById("pos-total-amt").innerHTML = inr(total);
  calcPosChange();
}

async function printPosBill() {
  if (posCart.length === 0)
    return customAlert("Cart is empty! Add items first.");

  if (!Auth.checkIsAdmin()) return; // Added simple protection check

  const cname =
    document.getElementById("pos-cname").value.trim() || "Walk-in Customer";
  const cphone = document.getElementById("pos-cphone").value.trim() || "\u2014";
  const total = posCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const dateStr = new Date().toISOString().split("T")[0];

  let lastNum = 0;
  if (pos_bills.length > 0) {
    const match = pos_bills[0].receiptNo.match(/\d+/);
    if (match) lastNum = parseInt(match[0], 10);
  }
  const receiptNo = "POS-" + String(lastNum + 1).padStart(4, "0");
  const d = { receiptNo, date: dateStr, total, items: posCart };

  try {
    await pb.collection("pos_bills").create(d);
    for (let cartItem of posCart) {
      const dbItem = items.find((i) => i.id === cartItem.id);
      if (dbItem && dbItem.hasStock) {
        const newQty = Math.max(0, dbItem.stockQty - cartItem.qty);
        await pb.collection("items").update(dbItem.id, { stockQty: newQty });
      }
    }
    await loadData(true);
  } catch (err) {
    console.error("Save Error:", err);
    return customAlert("Failed to save POS bill. Check database connection.");
  }

  // Draw the Thermal Receipt
  const rows = posCart
    .map(
      (it) =>
        `<tr style="border-bottom: 1px dashed #e2d5c0;"><td style="padding: 8px 0; color: #1a1000; font-size: 13px;">${it.name}</td><td style="padding: 8px 0; text-align:center; color: #1a1000; font-size: 13px;">${it.qty}</td><td style="padding: 8px 0; text-align:right; color: #1a1000; font-size: 13px;">${inr(it.price)}</td><td style="padding: 8px 0; text-align:right; color: #1a1000; font-size: 13px; font-weight:bold;">${inr(it.price * it.qty)}</td></tr>`,
    )
    .join("");
  document.getElementById("billbody").innerHTML =
    `<div style="font-family: 'Courier New', Courier, monospace; background: #fff; color: #1a1000; padding: 24px; border-radius: 8px; width: 100%; max-width: 400px; margin: 0 auto;" id="printbill">
      <div style="text-align: center; margin-bottom: 16px;"><div style="font-size: 22px; font-weight: bold; color: #1a1000; margin-bottom: 4px;">${SHOP.name}</div><div style="font-size: 12px; color: #555;">${SHOP.addr}</div><div style="font-size: 12px; color: #555;">Ph: ${SHOP.ph}</div></div>
      <div style="border-top: 1px dashed #1a1000; border-bottom: 1px dashed #1a1000; padding: 8px 0; margin-bottom: 16px; font-size: 12px; display: flex; justify-content: space-between;"><div><b>Receipt:</b> ${receiptNo}</div><div><b>Date:</b> ${fd(dateStr)}</div></div>
      <div style="font-size: 12px; margin-bottom: 16px;"><div><b>Customer:</b> ${cname}</div>${cphone !== "\u2014" ? `<div><b>Mob:</b> ${cphone}</div>` : ""}</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><thead><tr style="border-bottom: 1px solid #1a1000;"><th style="text-align: left; padding-bottom: 4px; font-size: 12px;">Item</th><th style="text-align: center; padding-bottom: 4px; font-size: 12px;">Qty</th><th style="text-align: right; padding-bottom: 4px; font-size: 12px;">Rate</th><th style="text-align: right; padding-bottom: 4px; font-size: 12px;">Amt</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="border-top: 1px dashed #1a1000; padding-top: 12px; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;"><span>TOTAL:</span><span>${inr(total)}</span></div>
      <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #555;">Thank you for your visit!<br>Have a sweet day!</div>
  </div>`;
  openOv("ov-bill");
  posCart = [];
}

function showPosBill(id) {
  const b = pos_bills.find((x) => x.id === id);
  if (!b) return;
  const rows = (b.items || [])
    .map(
      (it) =>
        `<tr style="border-bottom: 1px dashed #e2d5c0;"><td style="padding: 8px 0; color: #1a1000; font-size: 13px;">${it.name}</td><td style="padding: 8px 0; text-align:center; color: #1a1000; font-size: 13px;">${it.qty}</td><td style="padding: 8px 0; text-align:right; color: #1a1000; font-size: 13px;">${inr(it.price)}</td><td style="padding: 8px 0; text-align:right; color: #1a1000; font-size: 13px; font-weight:bold;">${inr(it.price * it.qty)}</td></tr>`,
    )
    .join("");
  document.getElementById("billbody").innerHTML =
    `<div style="font-family: 'Courier New', Courier, monospace; background: #fff; color: #1a1000; padding: 24px; border-radius: 8px; width: 100%; max-width: 400px; margin: 0 auto;" id="printbill">
      <div style="text-align: center; margin-bottom: 16px;"><div style="font-size: 22px; font-weight: bold; color: #1a1000; margin-bottom: 4px;">${SHOP.name}</div><div style="font-size: 12px; color: #555;">${SHOP.addr}</div><div style="font-size: 12px; color: #555;">Ph: ${SHOP.ph}</div></div>
      <div style="border-top: 1px dashed #1a1000; border-bottom: 1px dashed #1a1000; padding: 8px 0; margin-bottom: 16px; font-size: 12px; display: flex; justify-content: space-between;"><div><b>Receipt:</b> ${b.receiptNo}</div><div><b>Date:</b> ${fd(b.date)}</div></div>
      <div style="font-size: 12px; margin-bottom: 16px;"><div><b>Customer:</b> Walk-in Customer</div></div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><thead><tr style="border-bottom: 1px solid #1a1000;"><th style="text-align: left; padding-bottom: 4px; font-size: 12px;">Item</th><th style="text-align: center; padding-bottom: 4px; font-size: 12px;">Qty</th><th style="text-align: right; padding-bottom: 4px; font-size: 12px;">Rate</th><th style="text-align: right; padding-bottom: 4px; font-size: 12px;">Amt</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="border-top: 1px dashed #1a1000; padding-top: 12px; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;"><span>TOTAL:</span><span>${inr(b.total)}</span></div>
      <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #555;">Thank you for your visit!<br>Have a sweet day!</div>
  </div>`;
  openOv("ov-bill");
}
