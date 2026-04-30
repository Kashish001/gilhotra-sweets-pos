// src/js/db.js

const pb = new window.PocketBase("http://127.0.0.1:8090");

const SHOP = {
  name: "Gilhotra Sweets",
  tag: "Pure Desi Ghee Mithai \u2022 Since 1985",
  addr: "Main Bazar, Morinda",
  ph: "98765 43210",
};

// --- CUSTOM DIALOG SYSTEM ---
window.customAlert = function (msg) {
  return new Promise((resolve) => {
    document.getElementById("dialog-msg").innerText = msg;
    window._dialogResolve = resolve;
    document.getElementById("dialog-btns").innerHTML = `
            <button class="btn btn-a" onclick="closeOv('ov-dialog'); window._dialogResolve(true);">OK</button>
        `;
    openOv("ov-dialog");
  });
};

window.customConfirm = function (msg) {
  return new Promise((resolve) => {
    document.getElementById("dialog-msg").innerText = msg;
    window._dialogResolve = resolve;
    document.getElementById("dialog-btns").innerHTML = `
            <button class="btn" onclick="closeOv('ov-dialog'); window._dialogResolve(false);">Cancel</button>
            <button class="btn btn-a" style="background: var(--red); border-color: var(--red);" onclick="closeOv('ov-dialog'); window._dialogResolve(true);">Confirm</button>
        `;
    openOv("ov-dialog");
  });
};

const originalConfirm = window.confirm;
window.confirm = function (message) {
  const result = originalConfirm(message);
  setTimeout(() => {
    window.focus();
  }, 50);
  return result;
};
// ------------------------------

// Global State Variables
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
      hasStock: r.hasStock || false,
      stockQty: r.stockQty || 0,
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
      doj: r.doj || "",
      deductLeave: r.deductLeave || false,
      leaves: r.leaves || [],
    }));

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

  if (typeof popDatalist === "function") popDatalist();

  if (document.getElementById("dashboard-tc")?.classList.contains("on"))
    rDashboard();
  else if (document.getElementById("pos-tc")?.classList.contains("on")) rPos();
  else if (document.getElementById("ledger-tc")?.classList.contains("on"))
    rLedger();
  else if (document.getElementById("items-tc")?.classList.contains("on"))
    rItems();
  else if (document.getElementById("staff-tc")?.classList.contains("on"))
    rStaff();
}

// Utility Helpers
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

// UI Controllers
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
  toggler.innerHTML = isDark
    ? '<span class="tab-icon">&#9728;</span> Light Mode'
    : '<span class="tab-icon">&#9790;</span> Dark Mode';
}

// Global Event Listeners
document.querySelectorAll(".ov").forEach((el) => {
  el.addEventListener("click", function (e) {
    if (e.target === this) this.classList.remove("on");
  });
});
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape")
    document
      .querySelectorAll(".ov.on")
      .forEach((el) => el.classList.remove("on"));
});
document.addEventListener("click", function (e) {
  const dd = document.getElementById("cust-dropdown");
  const input = document.getElementById("f-name");
  if (dd && e.target !== input && !dd.contains(e.target))
    dd.style.display = "none";
});
