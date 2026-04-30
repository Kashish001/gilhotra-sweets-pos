const pb = new window.PocketBase("http://127.0.0.1:8090");

const SHOP = {
  name: "Gilhotra Sweets",
  tag: "Pure Desi Ghee Mithai \u2022 Since 1985",
  addr: "Main Bazar, Morinda",
  ph: "98765 43210",
};

let isDark = false,
  editId = null,
  editItemId = null,
  imgData = null,
  selCat = "All";
let entries = [],
  items = [],
  staff = [],
  pos_bills = [];
let activeStaffId = null;
let expandedCusts = new Set();
let currentItemRows = [];
let currentSuggestions = [];

// POS State
let posCart = [];
let posSelCat = "All";

function toggleLoader(show, text = "Syncing...") {
  const l = document.getElementById("loader");
  document.getElementById("loader-text").innerText = text;
  l.style.display = show ? "flex" : "none";
}

async function loadData(silent = false) {
  if (!silent) toggleLoader(true, "Loading Database...");

  try {
    const itemRecords = await pb
      .collection("items")
      .getFullList({ sort: "-created" });
    items = itemRecords.map((r) => ({
      id: r.id,
      name: r.name,
      cat: r.cat,
      price: r.price,
      unit: r.unit,
    }));

    const ledgerRecords = await pb
      .collection("ledger")
      .getFullList({ sort: "-created" });
    entries = ledgerRecords.map((r) => ({
      id: r.id,
      billNo: r.billNo,
      date: r.date,
      name: r.name,
      so: r.so,
      village: r.village,
      co: r.co,
      mobile: r.mobile,
      itemDetails: r.itemDetails,
      total: r.total,
      adv: r.adv,
      due: r.due,
      status: r.status,
      rem: r.rem,
      img: r.img ? pb.files.getUrl(r, r.img) : null,
      created: r.created,
    }));

    const staffRecords = await pb
      .collection("staff")
      .getFullList({ sort: "-created" });
    staff = staffRecords.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      salary: r.salary,
      status: r.status,
      balance: r.balance || 0,
      khata: r.khata || [],
      autoSalary: r.autoSalary !== undefined ? r.autoSalary : true,
      doj: r.doj || "", // NEW
      deductLeave: r.deductLeave || false, // NEW
      leaves: r.leaves || [], // NEW
    }));

    // NEW: Fetch POS Walk-in Sales
    const posRecords = await pb
      .collection("pos_bills")
      .getFullList({ sort: "-created" });
    pos_bills = posRecords.map((r) => ({
      id: r.id,
      receiptNo: r.receiptNo,
      date: r.date,
      total: r.total,
      items: r.items,
      created: r.created,
    }));
  } catch (err) {
    console.error("Database connection failed. Is PocketBase running?", err);
  }

  if (!silent) toggleLoader(false);
  popDatalist();

  if (
    document.getElementById("dashboard-tc") &&
    document.getElementById("dashboard-tc").classList.contains("on")
  ) {
    rDashboard();
  } else if (
    document.getElementById("pos-tc") &&
    document.getElementById("pos-tc").classList.contains("on")
  ) {
    rPos();
  } else if (
    document.getElementById("ledger-tc") &&
    document.getElementById("ledger-tc").classList.contains("on")
  ) {
    rLedger();
  } else if (
    document.getElementById("items-tc") &&
    document.getElementById("items-tc").classList.contains("on")
  ) {
    rItems();
  } else if (
    document.getElementById("staff-tc") &&
    document.getElementById("staff-tc").classList.contains("on")
  ) {
    rStaff();
  }
}

function popDatalist() {
  document.getElementById("item-suggestions").innerHTML = items
    .map((i) => `<option value="${i.name}">`)
    .join("");
}

function inr(n) {
  return (
    "\u20b9" +
    (+n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
function fd(d) {
  if (!d) return "\u2014";
  const p = d.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}
function pend(e) {
  return Math.max(0, (+e.total || 0) - (+e.adv || 0));
}

// ==========================================
// DASHBOARD & COMMAND CENTER
// ==========================================

function rDashboard() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("dash-date-title").innerText =
    `Today's Summary (${fd(today)})`;

  let todaySales = 0;
  let moneyIn = 0;
  let moneyOut = 0;
  let billsCut = 0;
  let activities = [];

  // 1. Process POS Bills (Walk-ins)
  pos_bills
    .filter((b) => b.date === today)
    .forEach((b) => {
      todaySales += b.total;
      moneyIn += b.total;
      billsCut++;
      activities.push({
        time: new Date(b.created).getTime(),
        html: `
      <div class="dash-act-row" onclick="showPosBill('${b.id}')" title="Click to view receipt">
        <div><div class="dash-type">Walk-in POS</div><div class="dash-desc">Receipt ${b.receiptNo}</div></div>
        <div class="dash-amt-in" style="display: flex; align-items: center; gap: 12px;">
            +${inr(b.total)} <span style="font-size: 16px; color: var(--tx-3);">&#128065;</span>
        </div>
      </div>`,
      });
    });

  // 2. Process Ledger Bills & Advances
  entries
    .filter((e) => e.date === today)
    .forEach((e) => {
      todaySales += e.total;
      moneyIn += e.adv;
      billsCut++;
      activities.push({
        time: new Date(e.created).getTime(),
        html: `
      <div class="dash-act-row" onclick="showBill('${e.id}')" title="Click to view bill">
        <div><div class="dash-type" style="color: var(--accent);">Ledger Bill</div><div class="dash-desc">${e.name} (${e.billNo})</div></div>
        <div class="dash-amt-in" style="color: var(--tx-2); font-size: 13px; display: flex; align-items: center; gap: 12px;">
            <span>Advance: +${inr(e.adv)} <span style="font-size:11px; color:var(--tx-3); margin-left: 6px;">(Total Bill: ${inr(e.total)})</span></span>
            <span style="font-size: 16px; color: var(--tx-3);">&#128065;</span>
        </div>
      </div>`,
      });
    });

  // 3. Process Staff Cash Payouts
  staff.forEach((s) => {
    (s.khata || [])
      .filter((k) => k.date === today)
      .forEach((k) => {
        if (k.type === "cash") {
          moneyOut += k.amount;
          activities.push({
            time: Date.now(),
            html: `
            <div class="dash-act-row" style="background: #fffafa;" onclick="openKhata('${s.id}')" title="Click to view Khata">
                <div><div class="dash-type" style="color: var(--red);">Staff Payout</div><div class="dash-desc">${s.name} - Cash Advance</div></div>
                <div class="dash-amt-out" style="display: flex; align-items: center; gap: 12px;">
                    -${inr(k.amount)} <span style="font-size: 16px; color: var(--tx-3);">&#128065;</span>
                </div>
            </div>`,
          });
        }
      });
  });

  // Render Stats
  document.getElementById("dash-stats").innerHTML = `
    <div class="scard"><div class="slbl">Total Sales (Value)</div><div class="sval">${inr(todaySales)}</div></div>
    <div class="scard" style="border-color: var(--green);"><div class="slbl" style="color: var(--green);">Cash IN</div><div class="sval g">${inr(moneyIn)}</div></div>
    <div class="scard" style="border-color: var(--red);"><div class="slbl" style="color: var(--red);">Cash OUT</div><div class="sval r">${inr(moneyOut)}</div></div>
    <div class="scard"><div class="slbl">Bills Cut</div><div class="sval">${billsCut}</div></div>
  `;

  // Render Activity Log
  const actHtml = activities
    .sort((a, b) => b.time - a.time)
    .map((a) => a.html)
    .join("");
  document.getElementById("dash-activity").innerHTML =
    actHtml ||
    `<div style="padding: 40px; text-align: center; color: var(--tx-3);">No transactions recorded today.</div>`;
}

// ==========================================
// QUICK BILL (POS) MANAGEMENT
// ==========================================

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
    .map(
      (it) => `
      <div class="icard" style="padding-bottom: 16px; border-bottom: 3px solid var(--accent); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; height: 100%;" onclick="addPosItem('${it.id}')">
          <div class="iname" style="font-size: 15px; margin-bottom: 6px; color: var(--tx-1);">${it.name}</div>
          <div class="iprice" style="font-size: 16px;">${inr(it.price)} <span style="font-size: 11px;">/ ${it.unit}</span></div>
      </div>
  `,
    )
    .join("");

  rPosCart();
}

function setPosCat(c) {
  posSelCat = c;
  rPos();
}

function addPosItem(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;

  const existing = posCart.find((i) => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    posCart.push({ ...item, qty: 1 });
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
  if (posCart.length > 0 && !confirm("Clear the current Quick Bill cart?"))
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
      return `
      <div class="pos-cart-item">
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

// SAVING AND GENERATING RECEIPT NUMBERS
async function printPosBill() {
  if (posCart.length === 0) {
    alert("Cart is empty! Add items first.");
    return;
  }

  const cname =
    document.getElementById("pos-cname").value.trim() || "Walk-in Customer";
  const cphone = document.getElementById("pos-cphone").value.trim() || "\u2014";
  const total = posCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const dateStr = new Date().toISOString().split("T")[0];

  // Logic for Auto-Incrementing Receipt Number based on database
  let lastNum = 0;
  if (pos_bills.length > 0) {
    const match = pos_bills[0].receiptNo.match(/\d+/);
    if (match) lastNum = parseInt(match[0], 10);
  }
  const receiptNo = "POS-" + String(lastNum + 1).padStart(4, "0");

  const d = { receiptNo, date: dateStr, total, items: posCart };

  try {
    await pb.collection("pos_bills").create(d);
    await loadData(true); // SILENT RELOAD so the dashboard gets the new sale
  } catch (err) {
    console.error("Save Error:", err);
    alert("Failed to save POS bill. Check database connection.");
    return;
  }

  // Draw the Thermal Receipt
  const rows = posCart
    .map(
      (it) => `
      <tr style="border-bottom: 1px dashed #e2d5c0;">
          <td style="padding: 8px 0; color: #1a1000; font-size: 13px;">${it.name}</td>
          <td style="padding: 8px 0; text-align:center; color: #1a1000; font-size: 13px;">${it.qty}</td>
          <td style="padding: 8px 0; text-align:right; color: #1a1000; font-size: 13px;">${inr(it.price)}</td>
          <td style="padding: 8px 0; text-align:right; color: #1a1000; font-size: 13px; font-weight:bold;">${inr(it.price * it.qty)}</td>
      </tr>
  `,
    )
    .join("");

  document.getElementById("billbody").innerHTML = `
      <div style="font-family: 'Courier New', Courier, monospace; background: #fff; color: #1a1000; padding: 24px; border-radius: 8px; width: 100%; max-width: 400px; margin: 0 auto;" id="printbill">
          <div style="text-align: center; margin-bottom: 16px;">
              <div style="font-size: 22px; font-weight: bold; color: #1a1000; margin-bottom: 4px;">${SHOP.name}</div>
              <div style="font-size: 12px; color: #555;">${SHOP.addr}</div>
              <div style="font-size: 12px; color: #555;">Ph: ${SHOP.ph}</div>
          </div>

          <div style="border-top: 1px dashed #1a1000; border-bottom: 1px dashed #1a1000; padding: 8px 0; margin-bottom: 16px; font-size: 12px; display: flex; justify-content: space-between;">
              <div><b>Receipt:</b> ${receiptNo}</div>
              <div><b>Date:</b> ${fd(dateStr)}</div>
          </div>

          <div style="font-size: 12px; margin-bottom: 16px;">
              <div><b>Customer:</b> ${cname}</div>
              ${cphone !== "\u2014" ? `<div><b>Mob:</b> ${cphone}</div>` : ""}
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <thead>
                  <tr style="border-bottom: 1px solid #1a1000;">
                      <th style="text-align: left; padding-bottom: 4px; font-size: 12px;">Item</th>
                      <th style="text-align: center; padding-bottom: 4px; font-size: 12px;">Qty</th>
                      <th style="text-align: right; padding-bottom: 4px; font-size: 12px;">Rate</th>
                      <th style="text-align: right; padding-bottom: 4px; font-size: 12px;">Amt</th>
                  </tr>
              </thead>
              <tbody>
                  ${rows}
              </tbody>
          </table>

          <div style="border-top: 1px dashed #1a1000; padding-top: 12px; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
              <span>TOTAL:</span>
              <span>${inr(total)}</span>
          </div>

          <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #555;">
              Thank you for your visit!<br>Have a sweet day!
          </div>
      </div>
  `;
  openOv("ov-bill");
  posCart = []; // Auto clear cart after printing
}

function showPosBill(id) {
  const b = pos_bills.find((x) => x.id === id);
  if (!b) return;

  const rows = (b.items || [])
    .map(
      (it) => `
      <tr style="border-bottom: 1px dashed #e2d5c0;">
          <td style="padding: 8px 0; color: #1a1000; font-size: 13px;">${it.name}</td>
          <td style="padding: 8px 0; text-align:center; color: #1a1000; font-size: 13px;">${it.qty}</td>
          <td style="padding: 8px 0; text-align:right; color: #1a1000; font-size: 13px;">${inr(it.price)}</td>
          <td style="padding: 8px 0; text-align:right; color: #1a1000; font-size: 13px; font-weight:bold;">${inr(it.price * it.qty)}</td>
      </tr>
  `,
    )
    .join("");

  document.getElementById("billbody").innerHTML = `
      <div style="font-family: 'Courier New', Courier, monospace; background: #fff; color: #1a1000; padding: 24px; border-radius: 8px; width: 100%; max-width: 400px; margin: 0 auto;" id="printbill">
          <div style="text-align: center; margin-bottom: 16px;">
              <div style="font-size: 22px; font-weight: bold; color: #1a1000; margin-bottom: 4px;">${SHOP.name}</div>
              <div style="font-size: 12px; color: #555;">${SHOP.addr}</div>
              <div style="font-size: 12px; color: #555;">Ph: ${SHOP.ph}</div>
          </div>
          <div style="border-top: 1px dashed #1a1000; border-bottom: 1px dashed #1a1000; padding: 8px 0; margin-bottom: 16px; font-size: 12px; display: flex; justify-content: space-between;">
              <div><b>Receipt:</b> ${b.receiptNo}</div>
              <div><b>Date:</b> ${fd(b.date)}</div>
          </div>
          <div style="font-size: 12px; margin-bottom: 16px;">
              <div><b>Customer:</b> Walk-in Customer</div>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <thead>
                  <tr style="border-bottom: 1px solid #1a1000;">
                      <th style="text-align: left; padding-bottom: 4px; font-size: 12px;">Item</th>
                      <th style="text-align: center; padding-bottom: 4px; font-size: 12px;">Qty</th>
                      <th style="text-align: right; padding-bottom: 4px; font-size: 12px;">Rate</th>
                      <th style="text-align: right; padding-bottom: 4px; font-size: 12px;">Amt</th>
                  </tr>
              </thead>
              <tbody>${rows}</tbody>
          </table>
          <div style="border-top: 1px dashed #1a1000; padding-top: 12px; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
              <span>TOTAL:</span>
              <span>${inr(b.total)}</span>
          </div>
          <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #555;">
              Thank you for your visit!<br>Have a sweet day!
          </div>
      </div>
  `;
  openOv("ov-bill");
}

// ==========================================
// LEDGER, ITEMS, & MODAL LOGIC
// ==========================================

function rLedger() {
  const q = (document.getElementById("srch").value || "").toLowerCase();
  const st = document.getElementById("fst").value;
  const grouped = {};
  let totalCusts = 0,
    totalBilled = 0,
    totalColl = 0,
    totalPend = 0;

  entries.forEach((e) => {
    if (
      (q &&
        !(e.name + (e.so || "") + e.village + e.billNo + e.mobile)
          .toLowerCase()
          .includes(q)) ||
      (st && e.status !== st && st !== "")
    )
      return;

    const key = e.name.toLowerCase().trim() + "|" + (e.mobile || "").trim();
    if (!grouped[key]) {
      grouped[key] = {
        name: e.name,
        so: e.so,
        mobile: e.mobile,
        village: e.village,
        bills: [],
        total: 0,
        adv: 0,
      };
      totalCusts++;
    }
    grouped[key].bills.push(e);
    grouped[key].total += +e.total || 0;
    grouped[key].adv += +e.adv || 0;
    totalBilled += +e.total || 0;
    totalColl += +e.adv || 0;
    totalPend += pend(e);
  });

  document.getElementById("stats").innerHTML = `
    <div class="scard"><div class="slbl">Total Customers</div><div class="sval">${totalCusts}</div></div>
    <div class="scard"><div class="slbl">Total Billed</div><div class="sval a">${inr(totalBilled)}</div></div>
    <div class="scard"><div class="slbl">Total Collected</div><div class="sval g">${inr(totalColl)}</div></div>
    <div class="scard"><div class="slbl">Pending Balance</div><div class="sval r">${inr(totalPend)}</div></div>`;

  const tb = document.getElementById("ltbody");
  if (Object.keys(grouped).length === 0) {
    tb.innerHTML = `<tr><td colspan="9" style="text-align: center !important; padding: 40px; white-space: normal; color: var(--tx-3);">No records found.</td></tr>`;
    return;
  }

  let html = "";
  for (let key in grouped) {
    const g = grouped[key];
    const p = Math.max(0, g.total - g.adv);
    const isExp = expandedCusts.has(key);
    let aggStatus = p <= 0 ? "Paid" : g.adv > 0 ? "Partial" : "Pending";
    let bc =
      aggStatus === "Paid"
        ? "paid"
        : aggStatus === "Partial"
          ? "partial"
          : "pending";

    html += `
        <tr class="cust-row" onclick="toggleCust('${key}')">
            <td style="text-align:center; padding: 0; overflow: visible; text-overflow: clip;">
                <span class="toggle-icon" style="transform: rotate(${isExp ? "90deg" : "0deg"})">&#9654;</span>
            </td>
            <td>
                <div style="font-weight: bold; color: var(--tx-1);">${g.name}</div>
                <div style="font-size: 11px; color: var(--tx-3);">${g.mobile || ""}</div>
            </td>
            <td style="color:var(--tx-2)">${g.so || "\u2014"}</td>
            <td style="color:var(--tx-2)">${g.village || "\u2014"}</td>
            <td style="color:var(--tx-2); text-align:center;">${g.bills.length}</td>
            <td style="text-align:right;">${inr(g.total)}</td>
            <td style="color:${p > 0 ? "var(--red)" : "var(--green)"}; text-align:right;">${inr(p)}</td>
            <td style="text-align:center;"><span class="bdg bdg-${bc}">${aggStatus}</span></td>
            <td style="text-align:center;">
                <button class="btn btn-sm btn-a" onclick="event.stopPropagation(); openEntryForCust('${key}')">+ New Bill</button>
            </td>
        </tr>`;

    if (isExp) {
      g.bills
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach((b) => {
          const bp = pend(b);
          const bbc =
            b.status === "Paid"
              ? "paid"
              : b.status === "Partial"
                ? "partial"
                : "pending";
          const itemsPreview = (b.itemDetails || [])
            .map(
              (x) =>
                `${x.name} <span style="color:var(--tx-3)">&times;${x.qty}</span>`,
            )
            .join(", ");

          html += `
                <tr class="bill-row open">
                    <td style="padding: 0;"></td>
                    <td style="padding-left: 16px;">
                        <div style="color:var(--accent); font-weight: bold; font-size: 13px;">${b.billNo || "No Bill #"}</div>
                        <div style="font-size:11px;color:var(--tx-3)">${fd(b.date)}</div>
                    </td>
                    <td colspan="3" style="font-size: 13px; color:var(--tx-2); max-width: 250px; overflow:hidden; text-overflow:ellipsis;" title="${(b.itemDetails || []).map((x) => x.name).join(", ")}">${itemsPreview || "\u2014"}</td>
                    <td style="font-size: 13px; text-align:right;">${inr(b.total)}</td>
                    <td style="font-size: 13px; color:${bp > 0 ? "var(--red)" : "var(--green)"}; text-align:right;">${inr(bp)}</td>
                    <td style="text-align:center;"><span class="bdg bdg-${bbc}" style="font-size: 10px;">${b.status}</span></td>
                    <td style="text-align:center;">
                        <div style="display: flex; gap: 6px; justify-content:center; align-items: center;">
                            <button class="ibtn" onclick="showBill('${b.id}')" title="Preview Bill">&#128196;</button>
                            <button class="ibtn" onclick="openEntry('${b.id}')" title="Edit Bill">&#9998;</button>
                            <button class="ibtn" style="color:var(--red); border-color:var(--red);" onclick="deleteEntry('${b.id}')" title="Delete Bill">&#128465;</button>
                        </div>
                    </td>
                </tr>`;
        });
    }
  }
  tb.innerHTML = html;
}

function toggleCust(key) {
  if (expandedCusts.has(key)) expandedCusts.delete(key);
  else expandedCusts.add(key);
  rLedger();
}

function renderItemRows() {
  const c = document.getElementById("item-rows-container");
  c.innerHTML = currentItemRows
    .map(
      (r, i) => `
<div class="i-grid-row">
    <input id="ir-name-${i}" list="item-suggestions" value="${r.name}" placeholder="Search or type item..." oninput="updIrName(${i}, this.value)">
    <input id="ir-qty-${i}" type="number" step="any" value="${r.qty}" placeholder="0" oninput="updIrNum(${i}, 'qty', this.value)">
    <input id="ir-rate-${i}" type="number" step="any" value="${r.rate}" placeholder="0" oninput="updIrNum(${i}, 'rate', this.value)">
    <input id="ir-amt-${i}" type="number" value="${r.amt.toFixed(2)}" readonly placeholder="0" style="background:var(--bg-row-alt); font-weight:bold; color:var(--tx-2);">
    <button class="row-del" onclick="rmIr(${i})" title="Remove Item">&#10006;</button>
</div>
`,
    )
    .join("");
  calcTotalFromRows();
}

function addIr(name = "", qty = "", rate = 0, amt = 0) {
  currentItemRows.push({ name, qty, rate, amt });
  renderItemRows();
  setTimeout(() => {
    const el = document.getElementById(`ir-name-${currentItemRows.length - 1}`);
    if (el) el.focus();
  }, 50);
}

function rmIr(i) {
  currentItemRows.splice(i, 1);
  if (currentItemRows.length === 0)
    currentItemRows = [{ name: "", qty: 1, rate: 0, amt: 0 }];
  renderItemRows();
}

function updIrName(i, val) {
  currentItemRows[i].name = val;
  const match = items.find(
    (x) => x.name.toLowerCase() === val.toLowerCase().trim(),
  );
  if (match) {
    currentItemRows[i].rate = match.price;
    const q = parseFloat(currentItemRows[i].qty) || 0;
    currentItemRows[i].amt = q * match.price;
    const rateEl = document.getElementById(`ir-rate-${i}`);
    const amtEl = document.getElementById(`ir-amt-${i}`);
    if (rateEl) rateEl.value = match.price;
    if (amtEl) amtEl.value = currentItemRows[i].amt.toFixed(2);
    calcTotalFromRows();
  }
}

function updIrNum(i, field, val) {
  currentItemRows[i][field] = val;
  const q = parseFloat(currentItemRows[i].qty) || 0;
  const r = parseFloat(currentItemRows[i].rate) || 0;
  currentItemRows[i].amt = q * r;
  const amtEl = document.getElementById(`ir-amt-${i}`);
  if (amtEl) amtEl.value = currentItemRows[i].amt.toFixed(2);
  calcTotalFromRows();
}

function calcTotalFromRows() {
  const t = currentItemRows.reduce(
    (sum, r) => sum + (parseFloat(r.amt) || 0),
    0,
  );
  document.getElementById("f-total").value = t > 0 ? t.toFixed(2) : "";
  autoCalc();
}

function checkExistingCustomer() {
  const v = document.getElementById("f-name").value.toLowerCase().trim();
  const dd = document.getElementById("cust-dropdown");

  if (!v || v.length < 2) {
    dd.style.display = "none";
    return;
  }

  const allMatches = entries.filter((e) => e.name.toLowerCase().includes(v));

  const uniqueCustomers = {};
  allMatches.forEach((e) => {
    const key = e.name.toLowerCase().trim() + "|" + (e.mobile || "").trim();
    if (!uniqueCustomers[key]) {
      uniqueCustomers[key] = e;
    }
  });

  currentSuggestions = Object.values(uniqueCustomers).slice(0, 4);

  if (currentSuggestions.length > 0) {
    let html = "";
    currentSuggestions.forEach((m, index) => {
      const metaDetails = [
        m.so ? `S/O ${m.so}` : null,
        m.village ? m.village : null,
        m.mobile ? m.mobile : null,
      ]
        .filter(Boolean)
        .join(" &bull; ");

      html += `
                <div class="autofill-item" onclick="applyCustomerFill(${index})">
                    <div class="af-name">${m.name}</div>
                    <div class="af-meta">${metaDetails || "No additional details"}</div>
                </div>
            `;
    });

    dd.innerHTML = html;
    dd.style.display = "flex";
  } else {
    dd.style.display = "none";
  }
}

function applyCustomerFill(index) {
  const match = currentSuggestions[index];
  if (!match) return;

  document.getElementById("f-name").value = match.name || "";
  document.getElementById("f-so").value = match.so || "";
  document.getElementById("f-village").value = match.village || "";
  document.getElementById("f-mobile").value = match.mobile || "";
  document.getElementById("f-co").value = match.co || "";

  document.getElementById("cust-dropdown").style.display = "none";
}

function openEntryForCust(key) {
  openEntry();
  const match = entries.find(
    (e) => e.name.toLowerCase().trim() + "|" + (e.mobile || "").trim() === key,
  );
  if (match) {
    document.getElementById("f-name").value = match.name;
    document.getElementById("f-so").value = match.so || "";
    document.getElementById("f-village").value = match.village || "";
    document.getElementById("f-mobile").value = match.mobile || "";
    document.getElementById("f-co").value = match.co || "";

    const dropdown = document.getElementById("cust-dropdown");
    if (dropdown) dropdown.style.display = "none";
  }
}

function openEntry(id = null) {
  editId = id;
  imgData = null;
  document.getElementById("fimg").value = "";

  const dropdown = document.getElementById("cust-dropdown");
  if (dropdown) dropdown.style.display = "none";

  const e = id ? entries.find((x) => x.id === id) : {};
  document.getElementById("entry-title").textContent = id
    ? "Edit Bill Entry"
    : "Create New Bill";

  [
    "billNo",
    "date",
    "name",
    "so",
    "village",
    "co",
    "mobile",
    "total",
    "due",
    "rem",
  ].forEach((k) => {
    const el = document.getElementById("f-" + k);
    if (el) el.value = e[k] || "";
  });

  document.getElementById("f-adv").value = e.adv !== undefined ? e.adv : "";
  document.getElementById("f-status").value = e.status || "Pending";

  currentItemRows = [];
  if (e.itemDetails && e.itemDetails.length > 0) {
    currentItemRows = JSON.parse(JSON.stringify(e.itemDetails));
  } else if (!id) {
    currentItemRows = [{ name: "", qty: 1, rate: 0, amt: 0 }];
  }
  renderItemRows();
  autoCalc();

  const fp = document.getElementById("fprev");
  if (e.img) {
    fp.src = e.img;
    fp.style.display = "block";
    imgData = e.img;
  } else {
    fp.style.display = "none";
    fp.src = "";
  }

  if (!e.date)
    document.getElementById("f-date").value = new Date()
      .toISOString()
      .split("T")[0];
  openOv("ov-entry");
}

function autoCalc() {
  const t = parseFloat(document.getElementById("f-total").value) || 0;
  const a = parseFloat(document.getElementById("f-adv").value) || 0;
  const p = Math.max(0, t - a);
  const el = document.getElementById("f-pend");
  el.value = p.toFixed(2);
  el.style.color = p > 0 ? "var(--red)" : "var(--green)";

  const st = document.getElementById("f-status");
  if (t > 0) {
    if (p <= 0) st.value = "Paid";
    else if (a > 0) st.value = "Partial";
    else st.value = "Pending";
  }
}

function onImg(evt) {
  const f = evt.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => {
    imgData = ev.target.result;
    const fp = document.getElementById("fprev");
    fp.src = imgData;
    fp.style.display = "block";
  };
  r.readAsDataURL(f);
}

// --- SILENT DATABASE SAVING ---
async function saveEntry() {
  const name = document.getElementById("f-name").value.trim();
  if (!name) {
    alert("Please provide a Customer Name.");
    return;
  }

  let bNo = document.getElementById("f-billNo").value.trim();
  if (!bNo) {
    let maxNum = 0;
    entries.forEach((e) => {
      if (e.billNo) {
        let match = e.billNo.match(/\d+/);
        if (match) {
          let num = parseInt(match[0], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    bNo = "P-" + String(maxNum + 1).padStart(3, "0");
  }

  const validItems = currentItemRows.filter((r) => r.name.trim() !== "");

  const formData = new FormData();
  formData.append("billNo", bNo);
  formData.append("date", document.getElementById("f-date").value);
  formData.append("name", name);
  formData.append("so", document.getElementById("f-so").value.trim());
  formData.append("village", document.getElementById("f-village").value);
  formData.append("co", document.getElementById("f-co").value);
  formData.append("mobile", document.getElementById("f-mobile").value);
  formData.append("itemDetails", JSON.stringify(validItems));
  formData.append(
    "total",
    parseFloat(document.getElementById("f-total").value) || 0,
  );
  formData.append(
    "adv",
    parseFloat(document.getElementById("f-adv").value) || 0,
  );
  formData.append("due", document.getElementById("f-due").value);
  formData.append("status", document.getElementById("f-status").value);
  formData.append("rem", document.getElementById("f-rem").value);

  const fileInput = document.getElementById("fimg");
  if (fileInput.files.length > 0) {
    formData.append("img", fileInput.files[0]);
  }

  try {
    if (editId) {
      await pb.collection("ledger").update(editId, formData);
    } else {
      await pb.collection("ledger").create(formData);
      expandedCusts.add(
        name.toLowerCase().trim() +
          "|" +
          (document.getElementById("f-mobile").value || "").trim(),
      );
    }
    closeOv("ov-entry");
    await loadData(true); // SILENT RELOAD
  } catch (err) {
    console.error("Save Error:", err);
    alert("Failed to save entry. Check database connection.");
  }
}

async function deleteEntry(id) {
  if (confirm("Are you sure you want to permanently delete this bill?")) {
    try {
      await pb.collection("ledger").delete(id);
      await loadData(true); // SILENT RELOAD
    } catch (err) {
      console.error("Delete Error:", err);
    }
  }
}

function viewImg(id) {
  const e = entries.find((x) => x.id === id);
  if (!e || !e.img) return;
  document.getElementById("bigimg").src = e.img;
  openOv("ov-img");
}

function showBill(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  const p = pend(e);

  const rows = (e.itemDetails || [])
    .map(
      (it) => `<tr style="border-bottom: 1px solid #f0d5a0;">
    <td style="padding: 10px 12px; color: #1a1000; font-size: 13px;">${it.name}</td>
    <td style="padding: 10px 12px; text-align:center; color: #1a1000; font-size: 13px;">${it.qty}</td>
    <td style="padding: 10px 12px; text-align:right; color: #1a1000; font-size: 13px;">${inr(it.rate)}</td>
    <td style="padding: 10px 12px; text-align:right; color: #1a1000; font-size: 13px;">${inr(it.amt)}</td>
</tr>`,
    )
    .join("");

  const imgblk = e.img
    ? `<div style="margin-top:20px;padding-top:16px;border-top:1px dashed #e0c090"><div style="margin-bottom:10px;display:flex;justify-content:space-between; align-items:center;"><span style="font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Handwritten Reference</span><span style="color:#bf6020; cursor:pointer; font-size:12px; background:#fdf6ee; padding: 4px 10px; border-radius:12px; border: 1px solid #f0d5a0;" onclick="viewImg('${e.id}')">&#128269; View Full Screen</span></div><img src="${e.img}" onclick="viewImg('${e.id}')" style="width:100%;border-radius:8px;border:1px solid #e0c090;max-height:280px;object-fit:contain;cursor:zoom-in; background: #fff;" title="Click to enlarge"></div>`
    : "";

  document.getElementById("billbody").innerHTML =
    `<div style="font-family: Georgia, serif; background: #fff; color: #1a1000; padding: 32px 32px 16px; border-top-left-radius: 16px; border-top-right-radius: 16px;" id="printbill">
<div style="font-size: 24px; font-weight: 500; color: #bf6020; text-align: center; letter-spacing: 0.2px;">${SHOP.name}</div>
<div style="font-size: 12px; color: #888; text-align: center; margin-top: 4px;">${SHOP.tag}</div>
<div style="font-size: 12px; color: #888; text-align: center; margin-bottom: 12px;">${SHOP.addr} &nbsp;|&nbsp; Ph: ${SHOP.ph}</div>

<div style="border-bottom: 2px solid #bf6020; margin-bottom: 16px;"></div>

<div style="display: flex; justify-content: space-between; font-size: 13px; color: #333; margin-bottom: 16px; font-weight: 500;">
    <span><b>Bill No.:</b> <span style="color:#bf6020">${e.billNo || "\u2014"}</span></span>
    <span><b>Date:</b> ${fd(e.date)}</span>
</div>

<div style="background: #fffcf8; border: 1px solid #f0d5a0; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
  <div><div style="font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Customer</div><div style="font-size: 14px; color: #1a1000; font-weight: 500; margin-top: 4px;">${e.name}</div></div>
  <div><div style="font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Father/Spouse</div><div style="font-size: 14px; color: #1a1000; font-weight: 500; margin-top: 4px;">${e.so || "\u2014"}</div></div>
  <div><div style="font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Mobile</div><div style="font-size: 14px; color: #1a1000; font-weight: 500; margin-top: 4px;">${e.mobile || "\u2014"}</div></div>
  <div><div style="font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Village / Location</div><div style="font-size: 14px; color: #1a1000; font-weight: 500; margin-top: 4px;">${e.village || "\u2014"} ${e.co ? `(C/O: ${e.co})` : ""}</div></div>
</div>

<div style="border: 1px solid #e2d5c0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
    <table style="width: 100%; border-collapse: collapse;">
        <thead>
            <tr style="background: #cf6a28;">
                <th style="color: #fff; padding: 10px 16px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Item Description</th>
                <th style="color: #fff; padding: 10px 16px; text-align: center; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; width:60px;">Qty</th>
                <th style="color: #fff; padding: 10px 16px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Rate</th>
                <th style="color: #fff; padding: 10px 16px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Amount</th>
            </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4" style="text-align:center; color:#888; padding: 16px;">No items listed</td></tr>'}</tbody>
    </table>
</div>

<div style="border: 1px solid #e2d5c0; background: #fff; padding: 16px; border-radius: 8px;">
  <div style="display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; color: #555;"><span>Subtotal Amount</span><span>${inr(e.total)}</span></div>
  <div style="display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; color:#256b42; margin-bottom: 8px;"><span>Advance Received</span><span>${inr(e.adv)}</span></div>
  <div style="border-bottom: 1px dashed #cf6a28; margin: 8px 0 12px;"></div>
  <div style="display: flex; justify-content: space-between; font-size: 16px; color:#1a1000; font-weight:bold;"><span>Balance Pending</span><span>${inr(p)}</span></div>
</div>

${e.due ? `<div style="font-size:13px;color:#555;margin-top:20px; text-align:center;">Due Date for payment: <b style="color:#b83025">${fd(e.due)}</b></div>` : ""}
${e.rem ? `<div style="font-size:13px;color:#666;margin-top:16px;padding:12px 16px;background:#fdfaf6;border-radius:6px; border-left: 3px solid #bf6020;"><b>Note:</b> ${e.rem}</div>` : ""}
${imgblk}
</div>`;
  openOv("ov-bill");
}

function doPrint() {
  const c = document.getElementById("printbill");
  if (!c) return;
  const w = window.open("", "_blank");
  w.document.write(
    `<html><head><title>Bill \u2014 ${SHOP.name}</title><style>*{box-sizing:border-box}body{font-family:Georgia,serif;margin:0;padding:20px;background:#fff}</style></head><body><div style="max-width:550px; margin:0 auto;">${c.innerHTML}</div></body></html>`,
  );
  w.document.close();
  w.print();
}

function rItems() {
  const cats = ["All", ...new Set(items.map((i) => i.cat))];
  document.getElementById("cpills").innerHTML = cats
    .map(
      (c) =>
        `<div class="cpill${c === selCat ? " on" : ""}" onclick="setCat('${c}')">${c}</div>`,
    )
    .join("");

  const list = selCat === "All" ? items : items.filter((i) => i.cat === selCat);
  document.getElementById("isgrid").innerHTML = list
    .map(
      (it) => `
<div class="icard" id="ic${it.id}">
  <div class="iname">${it.name}</div>
  <div class="icat">${it.cat}</div>
  <div class="iprice">${inr(it.price)} <span>/ ${it.unit}</span></div>
  <div class="card-actions">
     <button class="ibtn" onclick="openItemModal('${it.id}')" title="Edit Item">&#9998;</button>
     <button class="ibtn" style="color:var(--red);border-color:var(--red)" onclick="deleteItem('${it.id}')" title="Delete Item">&#128465;</button>
  </div>
</div>`,
    )
    .join("");
}

function setCat(c) {
  selCat = c;
  rItems();
}

function openItemModal(id = null) {
  editItemId = id;
  document.getElementById("item-title").textContent = id
    ? "Edit Item Price"
    : "Add New Item";
  if (id) {
    const it = items.find((x) => x.id === id);
    document.getElementById("im-name").value = it.name;
    document.getElementById("im-cat").value = it.cat;
    document.getElementById("im-price").value = it.price;
    document.getElementById("im-unit").value = it.unit;
  } else {
    ["im-name", "im-cat", "im-price"].forEach(
      (i) => (document.getElementById(i).value = ""),
    );
    document.getElementById("im-unit").value = "kg";
  }
  openOv("ov-item");
}

async function saveItem() {
  const name = document.getElementById("im-name").value.trim();
  if (!name) return;
  const d = {
    name,
    cat: document.getElementById("im-cat").value || "Other",
    price: parseFloat(document.getElementById("im-price").value) || 0,
    unit: document.getElementById("im-unit").value || "kg",
  };

  try {
    if (editItemId) {
      await pb.collection("items").update(editItemId, d);
    } else {
      await pb.collection("items").create(d);
    }
    closeOv("ov-item");
    await loadData(true);
  } catch (err) {
    console.error("Save Error:", err);
  }
}

async function deleteItem(id) {
  if (
    confirm("Are you sure you want to remove this item from the catalogue?")
  ) {
    try {
      await pb.collection("items").delete(id);
      await loadData(true);
    } catch (err) {
      console.error("Delete Error:", err);
    }
  }
}

function goTab(tab, btn) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.remove("on"));
  document.querySelectorAll(".tc").forEach((t) => t.classList.remove("on"));
  if (btn) btn.classList.add("on");
  else document.querySelector(`.tab[onclick*="${tab}"]`).classList.add("on");
  document.getElementById(tab + "-tc").classList.add("on");

  if (tab === "dashboard") rDashboard();
  if (tab === "ledger") rLedger();
  if (tab === "pos") rPos();
  if (tab === "items") rItems();
  if (tab === "staff") rStaff();
}

function openOv(id) {
  document.getElementById(id).classList.add("on");
}
function closeOv(id) {
  document.getElementById(id).classList.remove("on");
}

function toggleTheme() {
  isDark = !isDark;
  const s = document.getElementById("shell");
  s.classList.toggle("D", isDark);
  s.classList.toggle("L", !isDark);

  const toggler = document.getElementById("ttog");
  if (isDark) {
    toggler.innerHTML = '<span class="tab-icon">&#9728;</span> Light Mode';
  } else {
    toggler.innerHTML = '<span class="tab-icon">&#9790;</span> Dark Mode';
  }
}

document.querySelectorAll(".ov").forEach((el) => {
  el.addEventListener("click", function (e) {
    if (e.target === this) this.classList.remove("on");
  });
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    document
      .querySelectorAll(".ov.on")
      .forEach((el) => el.classList.remove("on"));
  }
});

document.addEventListener("click", function (e) {
  const dd = document.getElementById("cust-dropdown");
  const input = document.getElementById("f-name");
  if (dd && e.target !== input && !dd.contains(e.target)) {
    dd.style.display = "none";
  }
});

// ==========================================
// STAFF & KHATA MANAGEMENT
// ==========================================

function rStaff() {
  const q = (document.getElementById("s-srch").value || "").toLowerCase();
  const st = document.getElementById("s-fst").value;

  const filteredStaff = staff.filter((s) => {
    const matchQ = !q || (s.name + (s.role || "")).toLowerCase().includes(q);
    const matchSt = !st || s.status === st;
    return matchQ && matchSt;
  });

  const tb = document.getElementById("stbody");
  if (filteredStaff.length === 0) {
    tb.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--tx-3);">No staff records found.</td></tr>`;
    return;
  }

  let html = "";
  filteredStaff.forEach((s) => {
    let balColor = s.balance >= 0 ? "var(--green)" : "var(--red)";
    let balText =
      s.balance >= 0
        ? `Payable: ${inr(s.balance)}`
        : `Advance: ${inr(Math.abs(s.balance))}`;
    let statBadge =
      s.status === "Active"
        ? "paid"
        : s.status === "On Leave"
          ? "partial"
          : "pending";

    let leaveCount = (s.leaves || []).length;
    html += `
            <tr class="cust-row" onclick="openKhata('${s.id}')">
                <td style="font-weight: bold; color: var(--tx-1);">${s.name} <span style="font-size: 10px; color: var(--tx-3); margin-left: 6px;">${s.autoSalary ? "&#9881; Auto" : ""}</span></td>
                <td style="color: var(--tx-3);">${s.role || "\u2014"}</td>
                <td style="text-align: center; color: var(--tx-2); font-size: 12px;">${s.doj ? fd(s.doj) : "\u2014"}</td>
                <td style="text-align: right; color: var(--tx-2);">${inr(s.salary)} / mo</td>
                <td style="text-align: center;"><span style="background: #fdf6ee; color: var(--amber); padding: 2px 8px; border-radius: 12px; font-weight: bold; border: 1px solid #f0d5a0;">${leaveCount}</span></td>
                <td style="text-align: center;"><span class="bdg bdg-${statBadge}">${s.status}</span></td>
                <td style="text-align: right; color: ${balColor}; font-weight: bold;">${balText}</td>
                <td style="text-align: center;">
                    <button class="ibtn" onclick="event.stopPropagation(); openStaffModal('${s.id}')" title="Edit Staff">&#9998; Edit</button>
                </td>
            </tr>`;
  });
  tb.innerHTML = html;
}

function openStaffModal(id = null) {
  editId = id;
  document.getElementById("staff-title").textContent = id
    ? "Edit Staff"
    : "Add New Staff";

  if (id) {
    const s = staff.find((x) => x.id === id);
    document.getElementById("sf-name").value = s.name;
    document.getElementById("sf-role").value = s.role;
    document.getElementById("sf-salary").value = s.salary;
    document.getElementById("sf-status").value = s.status;
    document.getElementById("sf-auto").checked = s.autoSalary;
    document.getElementById("sf-doj").value = s.doj;
    document.getElementById("sf-deductLeave").checked = s.deductLeave;
  } else {
    ["sf-name", "sf-role", "sf-salary"].forEach(
      (i) => (document.getElementById(i).value = ""),
    );
    document.getElementById("sf-status").value = "Active";
    document.getElementById("sf-auto").checked = true;
    document.getElementById("sf-doj").value = "";
    document.getElementById("sf-deductLeave").checked = false;
  }
  openOv("ov-staff");
}

async function saveStaff() {
  const name = document.getElementById("sf-name").value.trim();
  if (!name) return;

  const d = {
    name,
    role: document.getElementById("sf-role").value,
    salary: parseFloat(document.getElementById("sf-salary").value) || 0,
    status: document.getElementById("sf-status").value,
    autoSalary: document.getElementById("sf-auto").checked,
    doj: document.getElementById("sf-doj").value, // NEW
    deductLeave: document.getElementById("sf-deductLeave").checked, // NEW
  };

  try {
    if (editId) {
      await pb.collection("staff").update(editId, d);
    } else {
      d.balance = 0;
      d.khata = [];
      await pb.collection("staff").create(d);
    }
    closeOv("ov-staff");
    await loadData(true);
  } catch (err) {
    console.error(err);
  }
}

function openKhata(id) {
  activeStaffId = id;
  const s = staff.find((x) => x.id === id);
  if (!s) return;

  let balColor = s.balance >= 0 ? "var(--green)" : "var(--red)";
  let balText =
    s.balance >= 0
      ? `Payable: ${inr(s.balance)}`
      : `Advance: ${inr(Math.abs(s.balance))}`;

  document.getElementById("khata-title").innerHTML =
    `${s.name} <span style="font-size: 14px; margin-left: 10px; padding: 4px 10px; border-radius: 12px; background: var(--bg-surface); color: ${balColor};">${balText}</span>`;
  document.getElementById("khata-sub").textContent =
    `${s.role} \u2022 Base: ${inr(s.salary)}`;

  document.getElementById("k-add-amt").value = "";
  document.getElementById("k-sub-amt").value = "";

  renderKhataTbody(s.khata);
  document.getElementById("k-leave-date").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("leave-count-bdg").innerText = (
    s.leaves || []
  ).length;
  renderLeaveTbody(s.leaves);
  switchKhataTab("fin");
  openOv("ov-khata");
}

function renderKhataTbody(khataArray) {
  const tb = document.getElementById("khata-tbody");
  if (!khataArray || khataArray.length === 0) {
    tb.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--tx-3);">No transactions yet.</td></tr>`;
    return;
  }
  const sorted = [...khataArray].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  tb.innerHTML = sorted
    .map((t) => {
      let isAdd = t.type === "salary";
      let isLeave = t.type === "leave";
      let color = isAdd ? "var(--green)" : "var(--red)";
      let sign = isAdd ? "+" : "-";
      let label = isAdd
        ? "Salary / Credit"
        : isLeave
          ? "Leave Auto-Deduction"
          : "Cash / Advance";
      return `<tr style="border-bottom: 1px solid var(--bd);">
            <td style="padding: 10px 12px; color: var(--tx-2); font-size: 11px;">${fd(t.date)}</td>
            <td style="padding: 10px 12px; font-weight: 500; color: var(--tx-1);">${label}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: ${color};">${sign} ${inr(t.amount)}</td>
        </tr>`;
    })
    .join("");
}

function renderLeaveTbody(leaveArray) {
  const tb = document.getElementById("leave-tbody");
  if (!leaveArray || leaveArray.length === 0) {
    tb.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 20px; color: var(--tx-3);">No leaves taken.</td></tr>`;
    return;
  }
  const sorted = [...leaveArray].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  tb.innerHTML = sorted
    .map(
      (l) => `
    <tr style="border-bottom: 1px solid var(--bd);">
        <td style="padding: 10px 12px; font-weight: bold; color: var(--amber);">${fd(l.date)}</td>
        <td style="padding: 10px 12px; text-align: right; color: var(--tx-2); font-size: 13px;">${l.remark}</td>
    </tr>
  `,
    )
    .join("");
}

function switchKhataTab(tab) {
  document.getElementById("tab-fin").classList.toggle("on", tab === "fin");
  document.getElementById("tab-leave").classList.toggle("on", tab === "leave");
  document.getElementById("khata-fin-view").style.display =
    tab === "fin" ? "block" : "none";
  document.getElementById("khata-leave-view").style.display =
    tab === "leave" ? "block" : "none";
}

async function postLeave() {
  const s = staff.find((x) => x.id === activeStaffId);
  if (!s) return;

  const dateStr = document.getElementById("k-leave-date").value;
  if (!dateStr) return alert("Please select a date.");

  let leavesArray = s.leaves || [];
  let khataArray = s.khata || [];
  let newBalance = s.balance;
  let leaveRemark = "Leave marked manually.";

  // Prevent duplicate leave entries for the same day
  if (leavesArray.some((l) => l.date === dateStr)) {
    return alert("A leave is already marked for this date.");
  }

  if (s.deductLeave && s.salary > 0) {
    const [year, month] = dateStr.split("-");
    const daysInMonth = new Date(year, month, 0).getDate();
    const perDayWage = Math.round(s.salary / daysInMonth);

    khataArray.push({
      date: dateStr,
      type: "leave",
      amount: perDayWage,
    });
    newBalance -= perDayWage;
    leaveRemark = `Auto-Debited ${inr(perDayWage)} from Khata (${daysInMonth} days in month).`;
  }

  leavesArray.push({ date: dateStr, remark: leaveRemark });

  try {
    await pb.collection("staff").update(s.id, {
      balance: newBalance,
      khata: khataArray,
      leaves: leavesArray,
    });
    await loadData(true);
    openKhata(s.id);
    switchKhataTab("leave"); // Auto switch to leave tab to show the new entry
  } catch (err) {
    console.error(err);
  }
}

async function postKhata(type) {
  const s = staff.find((x) => x.id === activeStaffId);
  if (!s) return;

  const inputId = type === "salary" ? "k-add-amt" : "k-sub-amt";
  const amt = parseFloat(document.getElementById(inputId).value);

  if (!amt || amt <= 0) return;

  let newBalance = s.balance;
  if (type === "salary") newBalance += amt;
  if (type === "cash") newBalance -= amt;

  const newTx = {
    date: new Date().toISOString().split("T")[0],
    type: type,
    amount: amt,
  };

  const updatedKhata = s.khata ? [...s.khata, newTx] : [newTx];

  try {
    await pb.collection("staff").update(s.id, {
      balance: newBalance,
      khata: updatedKhata,
    });

    await loadData(true);
    openKhata(s.id);
  } catch (err) {
    console.error(err);
  }
}

async function runAutoSalary() {
  const eligible = staff.filter(
    (s) => s.status === "Active" && s.autoSalary && s.salary > 0,
  );

  if (eligible.length === 0) {
    alert(
      "No active staff found with Auto-Salary enabled and a valid base salary.",
    );
    return;
  }

  const monthName = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  if (
    !confirm(
      `Are you sure you want to run bulk auto-salary?\n\nThis will instantly credit the base salary into the Khata of ${eligible.length} active employees for the month of ${monthName}.`,
    )
  )
    return;

  toggleLoader(true, "Processing Bulk Payroll...");

  const today = new Date().toISOString().split("T")[0];
  const currentMonthPrefix = today.substring(0, 7);

  let processedCount = 0;

  for (const s of eligible) {
    const alreadyPaidThisMonth = (s.khata || []).some(
      (t) =>
        t.type === "salary" && t.date.substring(0, 7) === currentMonthPrefix,
    );

    if (alreadyPaidThisMonth) {
      continue;
    }

    let newBalance = s.balance + s.salary;
    const newTx = {
      date: today,
      type: "salary",
      amount: s.salary,
    };
    const updatedKhata = s.khata ? [...s.khata, newTx] : [newTx];

    try {
      await pb.collection("staff").update(s.id, {
        balance: newBalance,
        khata: updatedKhata,
      });
      processedCount++;
    } catch (e) {
      console.error("Failed auto-salary for", s.name);
    }
  }

  await loadData(true);
  toggleLoader(false);

  if (processedCount > 0) {
    alert(
      `Success! Auto-Salary successfully processed for ${processedCount} employees.`,
    );
  } else {
    alert(
      `Notice: Auto-Salary was already processed for all eligible employees this month. No duplicates were added.`,
    );
  }
}

// Boot App
loadData();
