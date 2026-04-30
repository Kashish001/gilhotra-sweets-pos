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
      return `<tr style="border-bottom: 1px solid var(--bd);"><td style="padding: 10px 12px; color: var(--tx-2); font-size: 11px;">${fd(t.date)}</td><td style="padding: 10px 12px; font-weight: 500; color: var(--tx-1);">${label}</td><td style="padding: 10px 12px; text-align: right; font-weight: bold; color: ${color};">${sign} ${inr(t.amount)}</td></tr>`;
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

function switchKhataTab(tab) {
  document.getElementById("tab-fin").classList.toggle("on", tab === "fin");
  document.getElementById("tab-leave").classList.toggle("on", tab === "leave");
  document.getElementById("khata-fin-view").style.display =
    tab === "fin" ? "block" : "none";
  document.getElementById("khata-leave-view").style.display =
    tab === "leave" ? "block" : "none";
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
    await loadData(true);
    openKhata(s.id);
    switchKhataTab("leave");
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

  const newTx = {
    date: new Date().toISOString().split("T")[0],
    type: type,
    amount: amt,
  };
  const updatedKhata = s.khata ? [...s.khata, newTx] : [newTx];

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

async function runAutoSalary() {
  if (!Auth.checkIsAdmin()) return;

  const eligible = staff.filter(
    (s) => s.status === "Active" && s.autoSalary && s.salary > 0,
  );

  if (eligible.length === 0) {
    // NEW: Using customAlert instead of native alert
    await customAlert(
      "No active staff found with Auto-Salary enabled and a valid base salary.",
    );
    return;
  }

  const monthName = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  // NEW: Using customConfirm instead of native confirm
  const proceed = await customConfirm(
    `Are you sure you want to run bulk auto-salary?\n\nThis will instantly credit the base salary into the Khata of ${eligible.length} active employees for the month of ${monthName}.`,
  );
  if (!proceed) return; // If they click Cancel, stop here

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

  // NEW: Final customAlert message
  await customAlert(
    processedCount > 0
      ? `Success! Auto-Salary successfully processed for ${processedCount} employees.`
      : `Notice: Auto-Salary was already processed for all eligible employees this month. No duplicates were added.`,
  );
}
