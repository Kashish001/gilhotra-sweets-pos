// src/js/items.js

function popDatalist() {
  document.getElementById("item-suggestions").innerHTML = items
    .map((i) => `<option value="${i.name}">`)
    .join("");
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
      (it) => `<div class="icard" id="ic${it.id}">
  <div class="iname">${it.name}</div><div class="icat">${it.cat}</div><div class="iprice">${inr(it.price)} <span>/ ${it.unit}</span></div>
  <div class="card-actions"><button class="ibtn" onclick="openItemModal('${it.id}')" title="Edit Item">&#9998;</button><button class="ibtn" style="color:var(--red);border-color:var(--red)" onclick="deleteItem('${it.id}')" title="Delete Item">&#128465;</button></div>
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
    ? "Edit Item"
    : "Add New Item";

  if (id) {
    const it = items.find((x) => x.id === id);
    document.getElementById("im-name").value = it.name;
    document.getElementById("im-cat").value = it.cat;
    document.getElementById("im-price").value = it.price;
    document.getElementById("im-unit").value = it.unit;
    document.getElementById("im-hasStock").checked = it.hasStock;
    document.getElementById("im-stockQty").value = it.stockQty;
    document.getElementById("im-qty-box").style.display = it.hasStock
      ? "flex"
      : "none";
  } else {
    ["im-name", "im-cat", "im-price", "im-stockQty"].forEach(
      (i) => (document.getElementById(i).value = ""),
    );
    document.getElementById("im-unit").value = "kg";
    document.getElementById("im-hasStock").checked = false;
    document.getElementById("im-qty-box").style.display = "none";
  }
  openOv("ov-item");
}

async function saveItem() {
  if (!Auth.checkIsAdmin()) return;

  const name = document.getElementById("im-name").value.trim();
  if (!name) return;
  const d = {
    name,
    cat: document.getElementById("im-cat").value || "Other",
    price: parseFloat(document.getElementById("im-price").value) || 0,
    unit: document.getElementById("im-unit").value || "kg",
    hasStock: document.getElementById("im-hasStock").checked,
    stockQty: parseFloat(document.getElementById("im-stockQty").value) || 0,
  };

  try {
    if (editItemId) await pb.collection("items").update(editItemId, d);
    else await pb.collection("items").create(d);
    closeOv("ov-item");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await loadData(true);
  } catch (err) {
    console.error("Save Error:", err);
  }
}

async function deleteItem(id) {
  if (!Auth.checkIsAdmin()) return;
  if (
    customConfirm(
      "Are you sure you want to remove this item from the catalogue?",
    )
  ) {
    try {
      await pb.collection("items").delete(id);
      await loadData(true);
    } catch (err) {
      console.error("Delete Error:", err);
    }
  }
}
