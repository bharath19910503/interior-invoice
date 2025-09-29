window.jsPDF = window.jspdf.jsPDF;

let designs = [];
let invoicesDB = JSON.parse(localStorage.getItem("invoicesDB") || "{}");

// Elements
const addRowBtn = document.getElementById("addRowBtn");
const clearRowsBtn = document.getElementById("clearRowsBtn");
const invoiceTableBody = document.querySelector("#invoiceTable tbody");
const totalCostEl = document.getElementById("totalCost");
const gstAmountEl = document.getElementById("gstAmount");
const finalCostEl = document.getElementById("finalCost");
const gstPercentEl = document.getElementById("gstPercent");
const upload2D = document.getElementById("upload2D");
const designList = document.getElementById("designList");
const logoUpload = document.getElementById("logoUpload");
const logoImg = document.getElementById("logoImg");

// Add row
addRowBtn.addEventListener("click", () => {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input class="item"></td>
    <td><input class="material"></td>
    <td><input type="number" class="qty" value="1"></td>
    <td><input type="number" class="price" value="0"></td>
    <td class="amount">0.00</td>
    <td><button class="deleteBtn">X</button></td>
  `;
  invoiceTableBody.appendChild(row);
  bindRowEvents(row);
  calculateTotals();
});

function bindRowEvents(row) {
  const qty = row.querySelector(".qty");
  const price = row.querySelector(".price");
  const del = row.querySelector(".deleteBtn");
  qty.addEventListener("input", calculateTotals);
  price.addEventListener("input", calculateTotals);
  del.addEventListener("click", () => {
    row.remove();
    calculateTotals();
  });
}

// Calculate totals
function calculateTotals() {
  let total = 0;
  invoiceTableBody.querySelectorAll("tr").forEach(row => {
    const qty = parseFloat(row.querySelector(".qty").value) || 0;
    const price = parseFloat(row.querySelector(".price").value) || 0;
    const amt = qty * price;
    row.querySelector(".amount").textContent = amt.toFixed(2);
    total += amt;
  });
  const gstPct = parseFloat(gstPercentEl.value) || 0;
  const gstAmt = (total * gstPct) / 100;
  totalCostEl.textContent = total.toFixed(2);
  gstAmountEl.textContent = gstAmt.toFixed(2);
  finalCostEl.textContent = (total + gstAmt).toFixed(2);
}

// Clear all
clearRowsBtn.addEventListener("click", () => {
  invoiceTableBody.innerHTML = "";
  totalCostEl.textContent = gstAmountEl.textContent = finalCostEl.textContent = "0.00";
  document.getElementById("clientName").value = "";
  document.getElementById("invoiceNumber").value = "";
  document.getElementById("invoiceDate").value = "";
  designs = [];
  designList.innerHTML = "";
  logoImg.src = "";
  localStorage.removeItem("currentInvoice");
});

// Upload logo
logoUpload.addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = ev => logoImg.src = ev.target.result;
    reader.readAsDataURL(file);
  }
});

// Upload 2D designs
upload2D.addEventListener("change", e => {
  [...e.target.files].forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      const design = { name: file.name, img: ev.target.result, snapshot: null };
      designs.push(design);
      renderDesignList();
    };
    reader.readAsDataURL(file);
  });
});

function renderDesignList() {
  designList.innerHTML = "";
  designs.forEach((d, idx) => {
    const div = document.createElement("div");
    div.className = "design-item";
    div.innerHTML = `
      <img src="${d.img}" class="design-thumb">
      <input value="${d.name}" class="design-name">
      <button onclick="generate3D(${idx})">Generate 3D</button>
    `;
    designList.appendChild(div);
    div.querySelector(".design-name").addEventListener("input", ev => {
      designs[idx].name = ev.target.value;
    });
  });
}

// Generate 3D placeholder
function generate3D(index) {
  const canvas = document.createElement("canvas");
  canvas.width = 200; canvas.height = 200;
  const renderer = new THREE.WebGLRenderer({ canvas });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );
  scene.add(cube);
  camera.position.z = 2;
  renderer.render(scene, camera);
  designs[index].snapshot = canvas.toDataURL("image/png");
  alert("3D generated for " + designs[index].name);
}

// Generate PDF
document.getElementById("generatePDFBtn").addEventListener("click", () => {
  const clientName = document.getElementById("clientName").value.trim();
  const invoiceNumber = document.getElementById("invoiceNumber").value.trim();
  const invoiceDate = document.getElementById("invoiceDate").value;

  if (!invoiceNumber) return alert("Invoice Number required!");

  // Duplicate invoice check
  if (invoicesDB[invoiceNumber]) {
    return alert("Invoice number already exists!");
  }

  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(46, 125, 50);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Varshith Interior Solutions", 10, 12);

  // Logo
  if (logoImg.src) {
    doc.addImage(logoImg.src, "PNG", pageWidth - 40, 2, 30, 15);
  }

  // Invoice details
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Client: ${clientName}`, 14, 30);
  doc.text(`Invoice #: ${invoiceNumber}`, 14, 38);
  doc.text(`Date: ${invoiceDate}`, 14, 46);

  // Table
  const rows = [...invoiceTableBody.querySelectorAll("tr")].map(r => [
    r.querySelector(".item").value,
    r.querySelector(".material").value,
    r.querySelector(".qty").value,
    r.querySelector(".price").value,
    r.querySelector(".amount").textContent,
  ]);

  doc.autoTable({
    startY: 55,
    head: [["Item", "Material", "Qty", "Price", "Amount"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [46, 125, 50] }
  });

  let y = doc.lastAutoTable.finalY + 10;
  doc.text(`Total Cost: ${totalCostEl.textContent}`, 14, y);
  y += 8;
  doc.text(`GST: ${gstAmountEl.textContent}`, 14, y);
  y += 8;
  doc.text(`Final Cost: ${finalCostEl.textContent}`, 14, y);
  y += 12;
  doc.text("Payment note: 50% advance, 30% mid, 20% on completion.", 14, y);

  // Designs
  y += 15;
  designs.forEach(d => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 30;
    }
    doc.text(d.name, 14, y);
    if (d.snapshot) {
      doc.addImage(d.snapshot, "PNG", 14, y + 4, 40, 40);
      y += 50;
    } else {
      doc.addImage(d.img, "PNG", 14, y + 4, 40, 40);
      y += 50;
    }
  });

  // Footer with page numbers and contact info
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(46, 125, 50);
    doc.rect(0, pageHeight - 20, pageWidth, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(
      "Address: NO 39 BRN Ashish Layout, Anekal - 562106 | Phone: +91 9916511599, +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com",
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 8);
  }

  // Watermark once per page
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(40);
    doc.text("Varshith Interior Solutions", pageWidth / 2, pageHeight / 2, {
      align: "center"
    });
  }

  doc.save(`Invoice_${invoiceNumber}.pdf`);

  // Save invoice in DB
  invoicesDB[invoiceNumber] = {
    clientName,
    invoiceDate,
    rows,
    gst: gstPercentEl.value,
    designs,
    logo: logoImg.src
  };
  localStorage.setItem("invoicesDB", JSON.stringify(invoicesDB));
});

// Recover Invoice
function recoverInvoice(num) {
  const data = invoicesDB[num];
  if (!data) {
    alert("Invoice not found!");
    return;
  }
  document.getElementById("clientName").value = data.clientName;
  document.getElementById("invoiceNumber").value = num;
  document.getElementById("invoiceDate").value = data.invoiceDate;
  gstPercentEl.value = data.gst;
  logoImg.src = data.logo;

  invoiceTableBody.innerHTML = "";
  data.rows.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input class="item" value="${r[0]}"></td>
      <td><input class="material" value="${r[1]}"></td>
      <td><input type="number" class="qty" value="${r[2]}"></td>
      <td><input type="number" class="price" value="${r[3]}"></td>
      <td class="amount">${r[4]}</td>
      <td><button class="deleteBtn">X</button></td>
    `;
    invoiceTableBody.appendChild(row);
    bindRowEvents(row);
  });

  designs = data.designs || [];
  renderDesignList();
  calculateTotals();
}
