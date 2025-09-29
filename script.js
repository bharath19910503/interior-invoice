const invoiceTbody = document.querySelector("#invoiceTable tbody");
const addRowBtn = document.getElementById("addRowBtn");
const clearRowsBtn = document.getElementById("clearRowsBtn");
const totalCostEl = document.getElementById("totalCost");
const gstAmountEl = document.getElementById("gstAmount");
const finalCostEl = document.getElementById("finalCost");
const gstPercentEl = document.getElementById("gstPercent");
const generatePDFBtn = document.getElementById("generatePDFBtn");
const logoUpload = document.getElementById("logoUpload");
const logoImg = document.getElementById("logoImg");
const upload2D = document.getElementById("upload2D");
const designList = document.getElementById("designList");

let logoDataURL = null;
let designs = [];
let usedInvoiceNumbers = new Set();

// ========== Add Row ==========
function createRow(item = "", material = "", qty = 1, price = 0) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="item" value="${item}"></td>
    <td><input class="material" value="${material}"></td>
    <td><input type="number" class="qty" min="1" value="${qty}"></td>
    <td><input type="number" class="price" min="0" value="${price}"></td>
    <td><input class="amount" value="0" readonly></td>
    <td><button class="deleteBtn">X</button></td>
  `;
  invoiceTbody.appendChild(tr);
  tr.querySelector(".qty").addEventListener("input", recalcTotals);
  tr.querySelector(".price").addEventListener("input", recalcTotals);
  tr.querySelector(".deleteBtn").addEventListener("click", () => {
    tr.remove();
    recalcTotals();
  });
  recalcTotals();
}

addRowBtn.addEventListener("click", () => createRow());

// ========== Clear All ==========
clearRowsBtn.addEventListener("click", () => {
  invoiceTbody.innerHTML = "";
  document.getElementById("clientName").value = "";
  document.getElementById("invoiceNumber").value = "";
  document.getElementById("invoiceDate").value = "";
  gstPercentEl.value = 18;
  logoImg.src = "";
  logoDataURL = null;
  designs = [];
  designList.innerHTML = "";
  recalcTotals();
});

// ========== Totals ==========
function recalcTotals() {
  let total = 0;
  invoiceTbody.querySelectorAll("tr").forEach((tr) => {
    const qty = parseFloat(tr.querySelector(".qty").value) || 0;
    const price = parseFloat(tr.querySelector(".price").value) || 0;
    const amt = qty * price;
    tr.querySelector(".amount").value = amt.toFixed(2);
    total += amt;
  });
  const gstRate = parseFloat(gstPercentEl.value) || 0;
  const gst = (total * gstRate) / 100;
  const final = total + gst;
  totalCostEl.textContent = total.toFixed(2);
  gstAmountEl.textContent = gst.toFixed(2);
  finalCostEl.textContent = final.toFixed(2);
}

gstPercentEl.addEventListener("input", recalcTotals);

// ========== Logo Upload ==========
logoUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    logoDataURL = ev.target.result;
    logoImg.src = logoDataURL;
  };
  reader.readAsDataURL(file);
});

// ========== Designs ==========
upload2D.addEventListener("change", (e) => {
  [...e.target.files].forEach((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      designs.push({ name: file.name, dataURL: ev.target.result, snapshot: null });
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
      <img src="${d.dataURL}" class="design-thumb">
      <div class="design-info">
        <input value="${d.name}" class="design-name">
        <div class="design-controls">
          <button class="gen3dBtn">Generate 3D</button>
        </div>
      </div>
    `;
    div.querySelector(".design-name").addEventListener("input", (ev) => {
      designs[idx].name = ev.target.value;
    });
    div.querySelector(".gen3dBtn").addEventListener("click", () => {
      generate3DPreview(d, idx);
    });
    designList.appendChild(div);
  });
}

function generate3DPreview(design, idx) {
  const preview = document.getElementById("preview3D");
  preview.innerHTML = "";
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, preview.clientWidth / preview.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(preview.clientWidth, preview.clientHeight);
  preview.appendChild(renderer.domElement);

  const geometry = new THREE.BoxGeometry();
  const texture = new THREE.TextureLoader().load(design.dataURL);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  camera.position.z = 3;

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  // Snapshot
  setTimeout(() => {
    designs[idx].snapshot = renderer.domElement.toDataURL("image/png");
  }, 1500);
}

// ========== Generate PDF ==========
generatePDFBtn.addEventListener("click", () => {
  const invoiceNumber = document.getElementById("invoiceNumber").value;
  if (!invoiceNumber) {
    alert("Please provide Invoice Number");
    return;
  }
  if (usedInvoiceNumbers.has(invoiceNumber)) {
    alert("Invoice number already exists!");
    return;
  }
  usedInvoiceNumbers.add(invoiceNumber);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const headerHeight = 60;
  const footerHeight = 70;

  const companyAddress = "NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106";
  const companyPhone = "+91 9916511599 & +91 8553608981";
  const companyEmail = "Varshithinteriorsolutions@gmail.com";

  function addHeaderFooter(pageNum, totalPages) {
    // Header
    doc.setFillColor(46, 125, 50);
    doc.rect(0, 0, pageWidth, headerHeight, "F");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Varshith Interior Solutions", pageWidth / 2, 35, { align: "center" });

    // Footer
    doc.setFillColor(46, 125, 50);
    doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, "F");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(companyAddress, margin, pageHeight - 45);
    doc.text(`Phone: ${companyPhone}`, margin, pageHeight - 30);
    doc.text(`Email: ${companyEmail}`, margin, pageHeight - 15);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 100, pageHeight - 20);
  }

  function addWatermark() {
    doc.setFontSize(50);
    doc.setTextColor(230, 230, 230);
    for (let i = -pageHeight; i < pageHeight * 2; i += 150) {
      doc.text("Varshith Interior Solutions", pageWidth / 2, i, {
        angle: 45,
        align: "center",
      });
    }
  }

  const clientName = document.getElementById("clientName").value || "";
  const invoiceDate =
    document.getElementById("invoiceDate").value || new Date().toLocaleDateString();

  const body = [];
  invoiceTbody.querySelectorAll("tr").forEach((tr) => {
    body.push([
      tr.querySelector(".item").value,
      tr.querySelector(".material").value,
      tr.querySelector(".qty").value,
      tr.querySelector(".amount").value,
    ]);
  });

  doc.autoTable({
    head: [["Item", "Material", "Qty", "Amount"]],
    body,
    startY: headerHeight + 20,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [76, 175, 80], textColor: 255, halign: "center" },
    columnStyles: {
      0: { cellWidth: 150 },
      1: { cellWidth: 240 },
      2: { cellWidth: 50, halign: "center" },
      3: { cellWidth: 80, halign: "right" },
    },
    didDrawPage: function () {
      const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
      const totalPages = doc.internal.getNumberOfPages();
      addHeaderFooter(pageNumber, totalPages);
      addWatermark();
    },
  });

  let lastY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Total Cost: ${totalCostEl.textContent}`, margin, lastY);
  doc.text(`GST (${gstPercentEl.value}%): ${gstAmountEl.textContent}`, margin, lastY + 15);
  doc.text(`Final Cost: ${finalCostEl.textContent}`, margin, lastY + 30);
  doc.text(
    "Payment note: 50% advance, 30% mid, 20% completion",
    margin,
    lastY + 50
  );

  // Designs
  let yPos = lastY + 80;
  designs.forEach((d) => {
    if (d.snapshot || d.dataURL) {
      const img = d.snapshot || d.dataURL;
      const imgW = 180,
        imgH = 120;
      if (yPos + imgH > pageHeight - footerHeight - 20) {
        doc.addPage();
        yPos = headerHeight + 20;
      }
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(`Design: ${d.name}`, margin, yPos);
      doc.addImage(img, "PNG", margin, yPos + 5, imgW, imgH);
      yPos += imgH + 30;
    }
  });

  doc.save(`Invoice_${invoiceNumber}.pdf`);
});
