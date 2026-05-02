// src/js/staff.js

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

  tb.innerHTML = filteredStaff
    .map((s) => {
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
      return `<tr class="cust-row" onclick="openKhata('${s.id}')">
            <td style="font-weight: bold; color: var(--tx-1);">${s.name} <span style="font-size: 10px; color: var(--tx-3); margin-left: 6px;">${s.autoSalary ? "&#9881; Auto" : ""}</span></td>
            <td style="color: var(--tx-3);">${s.role || "\u2014"}</td>
            <td style="text-align: center; color: var(--tx-2); font-size: 12px;">${s.doj ? fd(s.doj) : "\u2014"}</td>
            <td style="text-align: right; color: var(--tx-2);">${inr(s.salary)} / mo</td>
            <td style="text-align: center;"><span style="background: #fdf6ee; color: var(--amber); padding: 2px 8px; border-radius: 12px; font-weight: bold; border: 1px solid #f0d5a0;">${leaveCount}</span></td>
            <td style="text-align: center;"><span class="bdg bdg-${statBadge}">${s.status}</span></td>
            <td style="text-align: right; color: ${balColor}; font-weight: bold;">${balText}</td>
            <td style="text-align: center;"><button class="ibtn" onclick="event.stopPropagation(); openStaffModal('${s.id}')" title="Edit Staff">&#9998; Edit</button></td>
        </tr>`;
    })
    .join("");
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

  // Restrict Future DOJ
  document.getElementById("sf-doj").max = new Date()
    .toISOString()
    .split("T")[0];
  openOv("ov-staff");
}

async function saveStaff() {
  if (!Auth.checkIsAdmin()) return;

  const name = document.getElementById("sf-name").value.trim();
  if (!name) return;
  const d = {
    name,
    role: document.getElementById("sf-role").value,
    salary: parseFloat(document.getElementById("sf-salary").value) || 0,
    status: document.getElementById("sf-status").value,
    autoSalary: document.getElementById("sf-auto").checked,
    doj: document.getElementById("sf-doj").value,
    deductLeave: document.getElementById("sf-deductLeave").checked,
  };

  try {
    if (editId) await pb.collection("staff").update(editId, d);
    else {
      d.balance = 0;
      d.khata = [];
      await pb.collection("staff").create(d);
    }
    closeOv("ov-staff");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await loadData(true);
  } catch (err) {
    console.error(err);
  }
}

// Add this new function anywhere in staff.js
window.onKhataItemSelect = function () {
  const itemId = document.getElementById("k-item-sel").value;
  const rateInput = document.getElementById("k-item-rate");

  if (!itemId) {
    rateInput.value = "";
    return;
  }

  const dbItem = items.find((i) => i.id === itemId);
  if (dbItem) {
    // Auto-fill the standard shop price
    rateInput.value = dbItem.price;
  }
};

// Update openKhata
function openKhata(id, targetTab = "fin") {
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

  // Reset all inputs
  document.getElementById("k-add-amt").value = "";
  document.getElementById("k-sub-amt").value = "";
  document.getElementById("k-item-qty").value = "";
  document.getElementById("k-item-rate").value = "";
  document.getElementById("k-item-rem").value = "";

  const todayStr = new Date().toISOString().split("T")[0];
  const leaveDateEl = document.getElementById("k-leave-date");
  const itemDateEl = document.getElementById("k-item-date");
  leaveDateEl.value = todayStr;
  leaveDateEl.max = todayStr;
  itemDateEl.value = todayStr;
  itemDateEl.max = todayStr;

  document.getElementById("k-item-sel").innerHTML =
    `<option value="">-- Select Item --</option>` +
    items
      .map(
        (i) =>
          `<option value="${i.id}">${i.name} (${inr(i.price)}/${i.unit})</option>`,
      )
      .join("");

  document.getElementById("leave-count-bdg").innerText = (
    s.leaves || []
  ).length;
  document.getElementById("item-count-bdg").innerText = (s.khata || []).filter(
    (k) => k.type === "item",
  ).length;

  renderKhataTbody(s.khata);
  renderLeaveTbody(s.leaves);
  renderItemsTbody(s.khata);

  // FIXED: Tell it to open the exact tab instantly without bouncing
  switchKhataTab(targetTab);
  openOv("ov-khata");
}

function renderKhataTbody(khataArray) {
  const tb = document.getElementById("khata-tbody");

  // Financial Khata ONLY shows Items if they were actually DEDUCTED from the salary
  const filteredKhata = (khataArray || []).filter(
    (t) => t.type !== "item" || t.deducted === true,
  );

  if (filteredKhata.length === 0) {
    tb.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--tx-3);">No financial transactions yet.</td></tr>`;
    return;
  }

  const sorted = [...filteredKhata].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  tb.innerHTML = sorted
    .map((t) => {
      let isAdd = t.type === "salary";
      let isLeave = t.type === "leave";
      let isItem = t.type === "item";

      let color = isAdd ? "var(--green)" : "var(--red)";
      let sign = isAdd ? "+" : "-";
      let label = isAdd
        ? "Salary / Credit"
        : isLeave
          ? "Leave Auto-Deduction"
          : isItem
            ? `Item: ${t.itemName} (x${t.qty})`
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
      (l) =>
        `<tr style="border-bottom: 1px solid var(--bd);"><td style="padding: 10px 12px; font-weight: bold; color: var(--amber);">${fd(l.date)}</td><td style="padding: 10px 12px; text-align: right; color: var(--tx-2); font-size: 13px;">${l.remark}</td></tr>`,
    )
    .join("");
}

function renderItemsTbody(khataArray) {
  const tb = document.getElementById("items-tbody");
  const itemsList = (khataArray || []).filter((t) => t.type === "item");

  if (itemsList.length === 0) {
    tb.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--tx-3);">No items taken.</td></tr>`;
    return;
  }

  const sorted = [...itemsList].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  tb.innerHTML = sorted
    .map((t) => {
      const deductBadge = t.deducted
        ? `<span style="background:var(--red); color:white; padding:2px 6px; border-radius:4px; font-size:9px; margin-left:6px;">DEDUCTED</span>`
        : `<span style="background:var(--green); color:white; padding:2px 6px; border-radius:4px; font-size:9px; margin-left:6px;">FREE</span>`;

      return `<tr style="border-bottom: 1px solid var(--bd);">
          <td style="padding: 10px 12px; color: var(--tx-2); font-size: 11px;">${fd(t.date)}</td>
          <td style="padding: 10px 12px; font-weight: 500; color: var(--tx-1);">
              ${t.itemName} <span style="color:var(--tx-3); font-size:11px;">x${t.qty}</span>
              ${deductBadge}
          </td>
          <td style="padding: 10px 12px; color: var(--tx-2); font-size: 12px;">${t.remark || "\u2014"}</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: var(--tx-1);">${inr(t.amount)}</td>
      </tr>`;
    })
    .join("");
}

function switchKhataTab(tab) {
  document.getElementById("tab-fin").classList.toggle("on", tab === "fin");
  document.getElementById("tab-leave").classList.toggle("on", tab === "leave");
  document.getElementById("tab-items").classList.toggle("on", tab === "items");

  document.getElementById("khata-fin-view").style.display =
    tab === "fin" ? "block" : "none";
  document.getElementById("khata-leave-view").style.display =
    tab === "leave" ? "block" : "none";
  document.getElementById("khata-items-view").style.display =
    tab === "items" ? "block" : "none";
}

async function postLeave() {
  if (!Auth.checkIsAdmin()) return;

  const s = staff.find((x) => x.id === activeStaffId);
  if (!s) return;
  const dateStr = document.getElementById("k-leave-date").value;
  if (!dateStr) return customAlert("Please select a date.");

  let leavesArray = s.leaves || [];
  let khataArray = s.khata || [];
  let newBalance = s.balance;
  let leaveRemark = "Leave marked manually.";

  if (leavesArray.some((l) => l.date === dateStr))
    return customAlert("A leave is already marked for this date.");

  if (s.deductLeave && s.salary > 0) {
    const [year, month] = dateStr.split("-");
    const daysInMonth = new Date(year, month, 0).getDate();
    const perDayWage = Math.round(s.salary / daysInMonth);
    khataArray.push({ date: dateStr, type: "leave", amount: perDayWage });
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

    // FIXED: Silent reload, and instantly open the leave tab
    await loadData(true);
    openKhata(s.id, "leave");
  } catch (err) {
    console.error(err);
  }
}

async function postKhata(type) {
  if (!Auth.checkIsAdmin()) return;

  const s = staff.find((x) => x.id === activeStaffId);
  if (!s) return;
  const amt = parseFloat(
    document.getElementById(type === "salary" ? "k-add-amt" : "k-sub-amt")
      .value,
  );
  if (!amt || amt <= 0) return;

  let newBalance = s.balance;
  if (type === "salary") newBalance += amt;
  if (type === "cash") newBalance -= amt;

  const dateStr = new Date().toISOString().split("T")[0];

  // 1. Copy the existing Khata
  let updatedKhata = s.khata ? [...s.khata] : [];

  // 2. Check if a row already exists for this exact date and type (salary or cash)
  let existingIndex = updatedKhata.findIndex(
    (t) => t.date === dateStr && t.type === type,
  );

  if (existingIndex >= 0) {
    // 3a. If it exists, just add the money to that row
    updatedKhata[existingIndex].amount += amt;
  } else {
    // 3b. If it doesn't exist, create a new row
    updatedKhata.push({
      date: dateStr,
      type: type,
      amount: amt,
    });
  }

  try {
    await pb
      .collection("staff")
      .update(s.id, { balance: newBalance, khata: updatedKhata });
    await loadData(true);
    openKhata(s.id);
  } catch (err) {
    console.error(err);
  }
}

// NEW: Post Item to Khata
// Update postItem
async function postItem() {
  if (!Auth.checkIsAdmin()) return;

  const s = staff.find((x) => x.id === activeStaffId);
  if (!s) return;

  const dateStr = document.getElementById("k-item-date").value;
  const itemId = document.getElementById("k-item-sel").value;
  const qty = parseFloat(document.getElementById("k-item-qty").value);
  const customRate = parseFloat(document.getElementById("k-item-rate").value);
  const remark = document.getElementById("k-item-rem").value.trim();
  const deducted = document.getElementById("k-item-deduct").checked;

  if (
    !dateStr ||
    !itemId ||
    !qty ||
    qty <= 0 ||
    isNaN(customRate) ||
    customRate < 0
  ) {
    return customAlert(
      "Please provide the date, select an item, a valid quantity, and a valid rate.",
    );
  }

  const dbItem = items.find((i) => i.id === itemId);
  if (!dbItem) return;

  if (dbItem.hasStock && qty > dbItem.stockQty) {
    return customAlert(
      `Only ${dbItem.stockQty} ${dbItem.unit} available in stock.`,
    );
  }

  const amount = customRate * qty;
  let newBalance = s.balance;

  if (deducted) newBalance -= amount;

  // 1. Copy the existing Khata
  let updatedKhata = s.khata ? [...s.khata] : [];

  // 2. Look for the exact same item, on the exact same date, at the exact same rate
  let existingIndex = updatedKhata.findIndex(
    (t) =>
      t.date === dateStr &&
      t.type === "item" &&
      t.itemName === dbItem.name &&
      t.deducted === deducted &&
      t.rate === customRate,
  );

  if (existingIndex >= 0) {
    // 3a. If it exists, aggregate the math!
    updatedKhata[existingIndex].qty += qty;
    updatedKhata[existingIndex].amount += amount;

    // Combine remarks if a new one is typed
    if (remark) {
      if (updatedKhata[existingIndex].remark) {
        updatedKhata[existingIndex].remark += " | " + remark;
      } else {
        updatedKhata[existingIndex].remark = remark;
      }
    }
  } else {
    // 3b. If it doesn't exist, create a new row
    updatedKhata.push({
      date: dateStr,
      type: "item",
      amount: amount,
      itemName: dbItem.name,
      qty: qty,
      rate: customRate,
      remark: remark,
      deducted: deducted,
    });
  }

  try {
    if (dbItem.hasStock) {
      const newQty = Math.max(0, dbItem.stockQty - qty);
      await pb.collection("items").update(dbItem.id, { stockQty: newQty });
    }

    await pb
      .collection("staff")
      .update(s.id, { balance: newBalance, khata: updatedKhata });

    await loadData(true);
    openKhata(s.id, "items");
  } catch (err) {
    console.error(err);
    customAlert("Failed to save item.");
  }
}

async function runAutoSalary() {
  if (!Auth.checkIsAdmin()) return;

  const eligible = staff.filter(
    (s) => s.status === "Active" && s.autoSalary && s.salary > 0,
  );

  if (eligible.length === 0) {
    await customAlert(
      "No active staff found with Auto-Salary enabled and a valid base salary.",
    );
    return;
  }

  const monthName = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const proceed = await customConfirm(
    `Are you sure you want to run bulk auto-salary?\n\nThis will instantly credit the base salary into the Khata of ${eligible.length} active employees for the month of ${monthName}.`,
  );
  if (!proceed) return;

  toggleLoader(true, "Processing Bulk Payroll...");
  const today = new Date().toISOString().split("T")[0];
  const currentMonthPrefix = today.substring(0, 7);
  let processedCount = 0;

  for (const s of eligible) {
    if (
      (s.khata || []).some(
        (t) =>
          t.type === "salary" && t.date.substring(0, 7) === currentMonthPrefix,
      )
    )
      continue;
    let newBalance = s.balance + s.salary;
    const newTx = { date: today, type: "salary", amount: s.salary };
    const updatedKhata = s.khata ? [...s.khata, newTx] : [newTx];

    try {
      await pb
        .collection("staff")
        .update(s.id, { balance: newBalance, khata: updatedKhata });
      processedCount++;
    } catch (e) {
      console.error("Failed auto-salary for", s.name);
    }
  }

  await loadData(true);
  toggleLoader(false);

  await customAlert(
    processedCount > 0
      ? `Success! Auto-Salary successfully processed for ${processedCount} employees.`
      : `Notice: Auto-Salary was already processed for all eligible employees this month. No duplicates were added.`,
  );
}

// NEW: Generate an elegant PDF/Print report for the employee
function printKhata() {
  const s = staff.find((x) => x.id === activeStaffId);
  if (!s) return;

  // Separate and sort the data
  const finTx = (s.khata || [])
    .filter((t) => t.type !== "item" || t.deducted === true)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const itemTx = (s.khata || [])
    .filter((t) => t.type === "item")
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const leaves = (s.leaves || []).sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  const timestamp = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 1. Build Financial Rows
  let finRows = finTx
    .map((t) => {
      let isAdd = t.type === "salary";
      let isLeave = t.type === "leave";
      let isItem = t.type === "item";
      let sign = isAdd ? "+" : "-";
      let label = isAdd
        ? "Salary / Credit"
        : isLeave
          ? "Leave Auto-Deduction"
          : isItem
            ? `Item Deduction: ${t.itemName} (x${t.qty})`
            : "Cash / Advance";
      return `<tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${fd(t.date)}</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${label}</td><td style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #eee; font-weight: bold;">${sign}${inr(t.amount)}</td></tr>`;
    })
    .join("");
  if (!finRows)
    finRows = `<tr><td colspan="3" style="padding: 16px; text-align: center; color: #888; font-style: italic;">No financial records found.</td></tr>`;

  // 2. Build Item Rows
  let itemRows = itemTx
    .map((t) => {
      let deductStatus = t.deducted ? "Deducted from Khata" : "Given Free";
      return `<tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${fd(t.date)}</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;"><b>${t.itemName}</b> (x${t.qty})<br><span style="font-size: 11px; color: #777;">${deductStatus} ${t.remark ? " | " + t.remark : ""}</span></td><td style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #eee;">${inr(t.amount)}</td></tr>`;
    })
    .join("");
  if (!itemRows)
    itemRows = `<tr><td colspan="3" style="padding: 16px; text-align: center; color: #888; font-style: italic;">No items taken.</td></tr>`;

  // 3. Build Leave Rows
  let leaveRows = leaves
    .map((l) => {
      return `<tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${fd(l.date)}</td><td style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #eee;">${l.remark}</td></tr>`;
    })
    .join("");
  if (!leaveRows)
    leaveRows = `<tr><td colspan="2" style="padding: 16px; text-align: center; color: #888; font-style: italic;">No leaves recorded.</td></tr>`;

  // Determine current balance wording
  let balColor = s.balance >= 0 ? "#256b42" : "#b83025";
  let balLabel =
    s.balance >= 0 ? "Total Payable to Employee" : "Advance Due from Employee";

  // The Printable HTML Template
  const printHTML = `
    <html>
    <head>
        <title>Khata Report - ${s.name}</title>
        <style>
            @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .no-break { page-break-inside: avoid; }
            }
            body { font-family: 'Georgia', serif; color: #1a1000; line-height: 1.5; padding: 40px; margin: 0 auto; max-width: 800px; background: #fff; }
            h1, h2, h3 { color: #bf6020; margin: 0 0 8px 0; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #bf6020; padding-bottom: 20px; }
            .emp-card { display: flex; justify-content: space-between; background: #fdfaf6; padding: 20px 24px; border-radius: 12px; border: 1px solid #e2d5c0; margin-bottom: 30px; align-items: center; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; font-family: sans-serif; }
            th { background: #cf6a28; color: #fff; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
            .summary-foot { text-align: center; color: #777; font-size: 11px; margin-top: 50px; border-top: 1px dashed #e2d5c0; padding-top: 20px; font-family: sans-serif; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 style="font-size: 28px;">${SHOP.name}</h1>
            <div style="font-size: 14px; color: #555;">${SHOP.tag}</div>
            <div style="font-size: 14px; color: #555;">${SHOP.addr} | Ph: ${SHOP.ph}</div>
        </div>

        <div class="emp-card">
            <div>
                <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; font-family: sans-serif; letter-spacing: 1px;">Employee Details</div>
                <h2 style="margin: 4px 0; color: #1a1000; font-size: 24px;">${s.name}</h2>
                <div style="color: #666; font-size: 14px;">${s.role || "Staff Member"} &bull; Base Salary: ${inr(s.salary)}/mo</div>
            </div>
            <div style="text-align: right; background: #fff; padding: 12px 20px; border-radius: 8px; border: 1px solid #e2d5c0;">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; font-weight: bold; font-family: sans-serif;">${balLabel}</div>
                <div style="font-size: 26px; font-weight: bold; color: ${balColor}; margin-top: 4px;">${inr(Math.abs(s.balance))}</div>
            </div>
        </div>

        <div class="no-break">
            <h3 style="font-size: 18px; border-bottom: 1px solid #e2d5c0; padding-bottom: 6px;">1. Financial Ledger</h3>
            <table>
                <thead><tr><th>Date</th><th>Transaction Details</th><th style="text-align: right;">Amount</th></tr></thead>
                <tbody>${finRows}</tbody>
            </table>
        </div>

        <div class="no-break">
            <h3 style="font-size: 18px; border-bottom: 1px solid #e2d5c0; padding-bottom: 6px; margin-top: 20px;">2. Shop Items Taken</h3>
            <table>
                <thead><tr><th>Date</th><th>Item Description & Notes</th><th style="text-align: right;">Value</th></tr></thead>
                <tbody>${itemRows}</tbody>
            </table>
        </div>

        <div class="no-break">
            <h3 style="font-size: 18px; border-bottom: 1px solid #e2d5c0; padding-bottom: 6px; margin-top: 20px;">3. Leave History</h3>
            <table>
                <thead><tr><th>Date</th><th style="text-align: right;">Remarks</th></tr></thead>
                <tbody>${leaveRows}</tbody>
            </table>
        </div>

        <div class="summary-foot">
            This is a computer-generated report.<br>
            Generated on ${timestamp} by Gilhotra Sweet House POS System.
        </div>
    </body>
    </html>
    `;

  // Open a new hidden window, write the HTML, and trigger the print dialog
  const w = window.open("", "_blank");
  w.document.write(printHTML);
  w.document.close();

  // Give the browser a tiny delay to render the fonts/styles before opening the print dialog
  setTimeout(() => {
    w.print();
  }, 250);
}
