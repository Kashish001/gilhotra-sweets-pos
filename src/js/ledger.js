// src/js/ledger.js

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

  document.getElementById("stats").innerHTML =
    `<div class="scard"><div class="slbl">Total Customers</div><div class="sval">${totalCusts}</div></div><div class="scard"><div class="slbl">Total Billed</div><div class="sval a">${inr(totalBilled)}</div></div><div class="scard"><div class="slbl">Total Collected</div><div class="sval g">${inr(totalColl)}</div></div><div class="scard"><div class="slbl">Pending Balance</div><div class="sval r">${inr(totalPend)}</div></div>`;
  const tb = document.getElementById("ltbody");

  if (Object.keys(grouped).length === 0) {
    tb.innerHTML = `<tr><td colspan="9" style="text-align: center !important; padding: 40px; color: var(--tx-3);">No records found.</td></tr>`;
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

    html += `<tr class="cust-row" onclick="toggleCust('${key}')">
            <td style="text-align:center; padding: 0;"><span class="toggle-icon" style="transform: rotate(${isExp ? "90deg" : "0deg"})">&#9654;</span></td>
            <td><div style="font-weight: bold; color: var(--tx-1);">${g.name}</div><div style="font-size: 11px; color: var(--tx-3);">${g.mobile || ""}</div></td>
            <td style="color:var(--tx-2)">${g.so || "\u2014"}</td><td style="color:var(--tx-2)">${g.village || "\u2014"}</td>
            <td style="color:var(--tx-2); text-align:center;">${g.bills.length}</td><td style="text-align:right;">${inr(g.total)}</td>
            <td style="color:${p > 0 ? "var(--red)" : "var(--green)"}; text-align:right;">${inr(p)}</td>
            <td style="text-align:center;"><span class="bdg bdg-${bc}">${aggStatus}</span></td>
            <td style="text-align:center;"><button class="btn btn-sm btn-a" onclick="event.stopPropagation(); openEntryForCust('${key}')">+ New Bill</button></td>
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
          html += `<tr class="bill-row open"><td style="padding: 0;"></td><td style="padding-left: 16px;"><div style="color:var(--accent); font-weight: bold; font-size: 13px;">${b.billNo || "No Bill #"}</div><div style="font-size:11px;color:var(--tx-3)">${fd(b.date)}</div></td><td colspan="3" style="font-size: 13px; color:var(--tx-2); max-width: 250px; overflow:hidden; text-overflow:ellipsis;" title="${(b.itemDetails || []).map((x) => x.name).join(", ")}">${itemsPreview || "\u2014"}</td><td style="font-size: 13px; text-align:right;">${inr(b.total)}</td><td style="font-size: 13px; color:${bp > 0 ? "var(--red)" : "var(--green)"}; text-align:right;">${inr(bp)}</td><td style="text-align:center;"><span class="bdg bdg-${bbc}" style="font-size: 10px;">${b.status}</span></td><td style="text-align:center;"><div style="display: flex; gap: 6px; justify-content:center; align-items: center;"><button class="ibtn" onclick="showBill('${b.id}')" title="Preview Bill">&#128196;</button><button class="ibtn" onclick="openEntry('${b.id}')" title="Edit Bill">&#9998;</button><button class="ibtn" style="color:var(--red); border-color:var(--red);" onclick="deleteEntry('${b.id}')" title="Delete Bill">&#128465;</button></div></td></tr>`;
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
      (r, i) =>
        `<div class="i-grid-row"><input id="ir-name-${i}" list="item-suggestions" value="${r.name}" placeholder="Search or type item..." oninput="updIrName(${i}, this.value)"><input id="ir-qty-${i}" type="number" step="any" value="${r.qty}" placeholder="0" oninput="updIrNum(${i}, 'qty', this.value)"><input id="ir-rate-${i}" type="number" step="any" value="${r.rate}" placeholder="0" oninput="updIrNum(${i}, 'rate', this.value)"><input id="ir-amt-${i}" type="number" value="${r.amt.toFixed(2)}" readonly placeholder="0" style="background:var(--bg-row-alt); font-weight:bold; color:var(--tx-2);"><button class="row-del" onclick="rmIr(${i})" title="Remove Item">&#10006;</button></div>`,
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
    if (!uniqueCustomers[key]) uniqueCustomers[key] = e;
  });

  currentSuggestions = Object.values(uniqueCustomers).slice(0, 4);
  if (currentSuggestions.length > 0) {
    dd.innerHTML = currentSuggestions
      .map(
        (m, index) =>
          `<div class="autofill-item" onclick="applyCustomerFill(${index})"><div class="af-name">${m.name}</div><div class="af-meta">${[m.so ? `S/O ${m.so}` : null, m.village ? m.village : null, m.mobile ? m.mobile : null].filter(Boolean).join(" &bull; ") || "No additional details"}</div></div>`,
      )
      .join("");
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
    if (document.getElementById("cust-dropdown"))
      document.getElementById("cust-dropdown").style.display = "none";
  }
}

function openEntry(id = null) {
  editId = id;
  imgData = null;
  document.getElementById("fimg").value = "";
  if (document.getElementById("cust-dropdown"))
    document.getElementById("cust-dropdown").style.display = "none";

  const e = id ? entries.find((x) => x.id === id) : {};
  document.getElementById("entry-title").textContent = id
    ? "Edit Bill Entry"
    : "Create New Bill";

  // 1. Setup the Item Rows FIRST (This triggers the auto-calc that was wiping the total)
  currentItemRows =
    e.itemDetails && e.itemDetails.length > 0
      ? JSON.parse(JSON.stringify(e.itemDetails))
      : [{ name: "", qty: 1, rate: 0, amt: 0 }];

  renderItemRows();

  // 2. NOW, load the actual saved database values to safely override the auto-calculations
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

  // 3. Finally, calculate the pending balance based on the restored values
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

  // 4. Set the current date and restrict future dates
  const dateEl = document.getElementById("f-date");
  if (!e.date) {
    dateEl.value = new Date().toISOString().split("T")[0];
  }
  dateEl.max = new Date().toISOString().split("T")[0];

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

async function saveEntry() {
  if (!Auth.checkIsAdmin()) return; // Added simple protection check

  const name = document.getElementById("f-name").value.trim();
  if (!name) return customAlert("Please provide a Customer Name.");

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
  if (fileInput.files.length > 0) formData.append("img", fileInput.files[0]);

  try {
    if (editId) {
      await pb.collection("ledger").update(editId, formData);
    } else {
      await pb.collection("ledger").create(formData);
      for (let row of validItems) {
        const dbItem = items.find(
          (i) => i.name.toLowerCase() === row.name.toLowerCase(),
        );
        if (dbItem && dbItem.hasStock) {
          const newQty = Math.max(
            0,
            dbItem.stockQty - (parseFloat(row.qty) || 0),
          );
          await pb.collection("items").update(dbItem.id, { stockQty: newQty });
        }
      }
      expandedCusts.add(
        name.toLowerCase().trim() +
          "|" +
          (document.getElementById("f-mobile").value || "").trim(),
      );
    }
    closeOv("ov-entry");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await loadData(true);
  } catch (err) {
    console.error("Save Error:", err);
    customAlert("Failed to save entry. Check database connection.");
  }
}

async function deleteEntry(id) {
  if (!Auth.checkIsAdmin()) return;
  if (customConfirm("Are you sure you want to permanently delete this bill?")) {
    try {
      await pb.collection("ledger").delete(id);
      await loadData(true);
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
      (it) =>
        `<tr style="border-bottom: 1px solid #f0d5a0;"><td style="padding: 10px 12px; color: #1a1000; font-size: 13px;">${it.name}</td><td style="padding: 10px 12px; text-align:center; color: #1a1000; font-size: 13px;">${it.qty}</td><td style="padding: 10px 12px; text-align:right; color: #1a1000; font-size: 13px;">${inr(it.rate)}</td><td style="padding: 10px 12px; text-align:right; color: #1a1000; font-size: 13px;">${inr(it.amt)}</td></tr>`,
    )
    .join("");
  const imgblk = e.img
    ? `<div style="margin-top:20px;padding-top:16px;border-top:1px dashed #e0c090"><div style="margin-bottom:10px;display:flex;justify-content:space-between; align-items:center;"><span style="font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Handwritten Reference</span><span style="color:#bf6020; cursor:pointer; font-size:12px; background:#fdf6ee; padding: 4px 10px; border-radius:12px; border: 1px solid #f0d5a0;" onclick="viewImg('${e.id}')">&#128269; View Full Screen</span></div><img src="${e.img}" onclick="viewImg('${e.id}')" style="width:100%;border-radius:8px;border:1px solid #e0c090;max-height:280px;object-fit:contain;cursor:zoom-in; background: #fff;" title="Click to enlarge"></div>`
    : "";
  document.getElementById("billbody").innerHTML =
    `<div style="font-family: Georgia, serif; background: #fff; color: #1a1000; padding: 32px 32px 16px; border-top-left-radius: 16px; border-top-right-radius: 16px;" id="printbill"><div style="font-size: 24px; font-weight: 500; color: #bf6020; text-align: center; letter-spacing: 0.2px;">${SHOP.name}</div><div style="font-size: 12px; color: #888; text-align: center; margin-top: 4px;">${SHOP.tag}</div><div style="font-size: 12px; color: #888; text-align: center; margin-bottom: 12px;">${SHOP.addr} &nbsp;|&nbsp; Ph: ${SHOP.ph}</div><div style="border-bottom: 2px solid #bf6020; margin-bottom: 16px;"></div><div style="display: flex; justify-content: space-between; font-size: 13px; color: #333; margin-bottom: 16px; font-weight: 500;"><span><b>Bill No.:</b> <span style="color:#bf6020">${e.billNo || "\u2014"}</span></span><span><b>Date:</b> ${fd(e.date)}</span></div><div style="background: #fffcf8; border: 1px solid #f0d5a0; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;"><div><div style="font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Customer</div><div style="font-size: 14px; color: #1a1000; font-weight: 500; margin-top: 4px;">${e.name}</div></div><div><div style="font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Father/Spouse</div><div style="font-size: 14px; color: #1a1000; font-weight: 500; margin-top: 4px;">${e.so || "\u2014"}</div></div><div><div style="font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Mobile</div><div style="font-size: 14px; color: #1a1000; font-weight: 500; margin-top: 4px;">${e.mobile || "\u2014"}</div></div><div><div style="font-size: 10px; color: #aaa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Village / Location</div><div style="font-size: 14px; color: #1a1000; font-weight: 500; margin-top: 4px;">${e.village || "\u2014"} ${e.co ? `(C/O: ${e.co})` : ""}</div></div></div><div style="border: 1px solid #e2d5c0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;"><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background: #cf6a28;"><th style="color: #fff; padding: 10px 16px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Item Description</th><th style="color: #fff; padding: 10px 16px; text-align: center; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; width:60px;">Qty</th><th style="color: #fff; padding: 10px 16px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Rate</th><th style="color: #fff; padding: 10px 16px; text-align: right; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center; color:#888; padding: 16px;">No items listed</td></tr>'}</tbody></table></div><div style="border: 1px solid #e2d5c0; background: #fff; padding: 16px; border-radius: 8px;"><div style="display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; color: #555;"><span>Subtotal Amount</span><span>${inr(e.total)}</span></div><div style="display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; color:#256b42; margin-bottom: 8px;"><span>Advance Received</span><span>${inr(e.adv)}</span></div><div style="border-bottom: 1px dashed #cf6a28; margin: 8px 0 12px;"></div><div style="display: flex; justify-content: space-between; font-size: 16px; color:#1a1000; font-weight:bold;"><span>Balance Pending</span><span>${inr(p)}</span></div></div>${e.due ? `<div style="font-size:13px;color:#555;margin-top:20px; text-align:center;">Due Date for payment: <b style="color:#b83025">${fd(e.due)}</b></div>` : ""}${e.rem ? `<div style="font-size:13px;color:#666;margin-top:16px;padding:12px 16px;background:#fdfaf6;border-radius:6px; border-left: 3px solid #bf6020;"><b>Note:</b> ${e.rem}</div>` : ""}${imgblk}</div>`;
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
