// ==============================
// Globals
// ==============================
let invoiceItems = [];
let designs = [];
let logoDataURL = null;
let currentInvoiceNumber = null;

// localStorage key
const STORAGE_KEY = "savedInvoices";

// ==============================
// Helpers
// ==============================
function formatCurrency(num) {
  return parseFloat(num || 0).toFixed(2);
}

function saveInvoice(invoiceData) {
  const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  store[invoiceData.invoiceNumber] = invoiceData;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function loadInvoice(invoiceNumber) {
  const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  return store[invoiceNumber] || null;
}

function getImageTypeFromDataURL(dataURL) {
  if (dataURL.startsWith("data:image/png")) return "PNG";
  if (dataURL.startsWith("data:image/jpeg")) return "JPEG";
  return "PNG";
}

// ==============================
// Invoice table
// ==============================
function renderInvoiceTable() {
  const tbody = document.querySelector("#invoiceTable tbody");
  tbody.innerHTML = "";
  invoiceItems.forEach((row, idx) => {
    const tr = document.createElement("tr");

    const tdItem = document.createElement("td");
    const inpItem = document.createElement("input");
    inpItem.value = row.item;
    inpItem.oninput = e => { invoiceItems[idx].item = e.target.value; };
    tdItem.appendChild(inpItem);

    const tdMat = document.createElement("td");
    const inpMat = document.createElement("input");
    inpMat.value = row.material;
    inpMat.oninput = e => { invoiceItems[idx].material = e.target.value; };
    tdMat.appendChild(inpMat);

    const tdQty = document.createElement("td");
    const inpQty = document.createElement("input");
    inpQty.type = "number"; inpQty.value = row.qty;
    inpQty.oninput = e => { invoiceItems[idx].qty = parseFloat(e.target.value) || 0; updateTotals(); };
    tdQty.appendChild(inpQty);

    const tdPrice = document.createElement("td");
    const inpPrice = document.createElement("input");
    inpPrice.type = "number"; inpPrice.value = row.unitPrice;
    inpPrice.oninput = e => { invoiceItems[idx].unitPrice = parseFloat(e.target.value) || 0; updateTotals(); };
    tdPrice.appendChild(inpPrice);

    const tdAmount = document.createElement("td");
    tdAmount.textContent = formatCurrency(row.qty * row.unitPrice);

    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "deleteBtn";
    delBtn.textContent = "X";
    delBtn.onclick = () => { invoiceItems.splice(idx, 1); renderInvoiceTable(); updateTotals(); };
    tdDel.appendChild(delBtn);

    tr.append(tdItem, tdMat, tdQty, tdPrice, tdAmount, tdDel);
    tbody.appendChild(tr);
  });
  updateTotals();
}

function updateTotals() {
  let total = invoiceItems.reduce((sum, r) => sum + (r.qty * r.unitPrice), 0);
  const gstPct = parseFloat(document.querySelector("#gstPercent").value) || 0;
  const gstAmt = total * gstPct / 100;
  const final = total + gstAmt;

  document.getElementById("totalCost").textContent = formatCurrency(total);
  document.getElementById("gstAmount").textContent = formatCurrency(gstAmt);
  document.getElementById("finalCost").textContent = formatCurrency(final);
}

// ==============================
// 2D → 3D Designer
// ==============================
function renderDesignList() {
  const list = document.getElementById("designList");
  list.innerHTML = "";
  designs.forEach((d, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "design-item";

    const img = document.createElement("img");
    img.src = d.dataURL;
    img.className = "design-thumb";

    const info = document.createElement("div");
    info.className = "design-info";

    const inpName = document.createElement("input");
    inpName.value = d.name;
    inpName.oninput = e => { designs[idx].name = e.target.value; };

    const controls = document.createElement("div");
    controls.className = "design-controls";
    const genBtn = document.createElement("button");
    genBtn.textContent = "Generate 3D";
    genBtn.onclick = () => generate3D(idx);

    controls.appendChild(genBtn);
    info.append(inpName, controls);
    wrap.append(img, info);
    list.appendChild(wrap);
  });
}

function generate3D(idx) {
  const container = document.getElementById("preview3D");
  container.innerHTML = "";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth/container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const tex = new THREE.TextureLoader().load(designs[idx].dataURL);
  const geo = new THREE.BoxGeometry(2,2,2);
  const mat = new THREE.MeshBasicMaterial({map:tex});
  const cube = new THREE.Mesh(geo, mat);
  scene.add(cube);

  camera.position.z = 4;
  function animate(){
    requestAnimationFrame(animate);
    cube.rotation.y += 0.01;
    controls.update();
    renderer.render(scene,camera);
  }
  animate();

  setTimeout(()=>{
    designs[idx].snapshot = renderer.domElement.toDataURL("image/png");
  },2000);
}

// ==============================
// PDF generation
// ==============================
function generatePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Header
  if (logoDataURL) {
    doc.addImage(logoDataURL, "PNG", 15, 10, 25, 25);
  }
  doc.setFontSize(16);
  doc.setTextColor(46,125,50);
  doc.text("Varshith Interior Solutions", 50, 20);
  doc.setFontSize(10);
  doc.setTextColor(0,0,0);
  doc.text("NO 39 BRN Ashish Layout, Near Sri Thimmaraya Swami Gudi, Anekal - 562106", 50, 26);
  doc.text("Phone: +91 9916511599, +91 8553608981", 50, 32);
  doc.text("Email: Varshithinteriorsolutions@gmail.com", 50, 38);

  // Meta
  const clientName = document.getElementById("clientName").value;
  const invoiceNumber = document.getElementById("invoiceNumber").value;
  const invoiceDate = document.getElementById("invoiceDate").value;
  doc.setFontSize(12);
  doc.text(`Client: ${clientName}`, 15, 50);
  doc.text(`Invoice #: ${invoiceNumber}`, 100, 50);
  doc.text(`Date: ${invoiceDate}`, 160, 50);

  // Table
  const body = invoiceItems.map(r=>[
    r.item, r.material, r.qty, formatCurrency(r.unitPrice), formatCurrency(r.qty*r.unitPrice)
  ]);
  doc.autoTable({
    startY: 60,
    head: [["Item","Material","Qty","Unit Price","Amount"]],
    body
  });

  let y = doc.autoTable.previous.finalY + 10;
  let total = parseFloat(document.getElementById("totalCost").textContent);
  let gst = parseFloat(document.getElementById("gstAmount").textContent);
  let final = parseFloat(document.getElementById("finalCost").textContent);

  doc.setFontSize(12);
  doc.text(`Total Cost: ${formatCurrency(total)}`, 15, y);
  y+=7;
  doc.text(`GST: ${formatCurrency(gst)}`, 15, y);
  y+=7;
  doc.text(`Final Cost: ${formatCurrency(final)}`, 15, y);
  y+=10;

  doc.setFontSize(11);
  doc.setTextColor(200,0,0);
  doc.text("Payment note: 50 PCT of the quoted amount has to be paid as advance,", 15, y);
  y+=6;
  doc.text("30 PCT after completing 50% of work and remaining 20 PCT after completion.", 15, y);
  doc.setTextColor(0,0,0);
  y+=15;

  // Designs
  designs.forEach(d=>{
    const imgData = d.snapshot || d.dataURL;
    if(!imgData) return;
    const imgW = 70, imgH=50;
    if(y+imgH+20 > doc.internal.pageSize.getHeight()){
      doc.addPage();
      y=30;
    }
    doc.setFontSize(10);
    doc.text(d.name,15,y);
    y+=5;
    try{
      doc.addImage(imgData,getImageTypeFromDataURL(imgData),15,y,imgW,imgH);
    }catch(e){console.warn("Img fail",e)}
    y+=imgH+10;
  });

  // Footer
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.text("Address: NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106", 15, h-20);
  doc.text("Phone: +91 9916511599 & +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com", 15, h-14);

  doc.save(`Invoice_${invoiceNumber}.pdf`);

  // Save invoice to storage
  const invoiceData = {
    clientName, invoiceNumber, invoiceDate,
    items: invoiceItems, designs, logoDataURL,
    gstPercent: document.getElementById("gstPercent").value
  };
  saveInvoice(invoiceData);
  currentInvoiceNumber = invoiceNumber;
}

// ==============================
// Export/Import JSON
// ==============================
function exportInvoiceJSON() {
  const clientName = document.getElementById("clientName").value;
  const invoiceNumber = document.getElementById("invoiceNumber").value;
  const invoiceDate = document.getElementById("invoiceDate").value;

  const data = {
    clientName, invoiceNumber, invoiceDate,
    items: invoiceItems, designs, logoDataURL,
    gstPercent: document.getElementById("gstPercent").value
  };
  const blob = new Blob([JSON.stringify(data)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Invoice_${invoiceNumber}.json`;
  a.click();
}

function importInvoiceJSON(file) {
  const reader = new FileReader();
  reader.onload = e=>{
    const data = JSON.parse(e.target.result);
    document.getElementById("clientName").value = data.clientName || "";
    document.getElementById("invoiceNumber").value = data.invoiceNumber || "";
    document.getElementById("invoiceDate").value = data.invoiceDate || "";
    document.getElementById("gstPercent").value = data.gstPercent || 0;
    invoiceItems = data.items || [];
    designs = data.designs || [];
    logoDataURL = data.logoDataURL || null;
    if(logoDataURL) document.getElementById("logoImg").src = logoDataURL;
    renderInvoiceTable();
    renderDesignList();
  };
  reader.readAsText(file);
}

// ==============================
// Load from localStorage by number
// ==============================
function loadFromStorage() {
  const invNo = document.getElementById("loadInvoiceNumber").value;
  const data = loadInvoice(invNo);
  if(!data){ alert("Invoice not found"); return; }
  document.getElementById("clientName").value = data.clientName || "";
  document.getElementById("invoiceNumber").value = data.invoiceNumber || "";
  document.getElementById("invoiceDate").value = data.invoiceDate || "";
  document.getElementById("gstPercent").value = data.gstPercent || 0;
  invoiceItems = data.items || [];
  designs = data.designs || [];
  logoDataURL = data.logoDataURL || null;
  if(logoDataURL) document.getElementById("logoImg").src = logoDataURL;
  renderInvoiceTable();
  renderDesignList();
}

// ==============================
// Event Listeners
// ==============================
document.getElementById("addRowBtn").onclick=()=>{
  invoiceItems.push({item:"",material:"",qty:0,unitPrice:0});
  renderInvoiceTable();
};
document.getElementById("clearRowsBtn").onclick=()=>{
  invoiceItems=[]; renderInvoiceTable();
};
document.getElementById("generatePDFBtn").onclick=generatePDF;
document.getElementById("exportJsonBtn").onclick=exportInvoiceJSON;
document.getElementById("importJsonBtn").onclick=()=>document.getElementById("importJsonFile").click();
document.getElementById("importJsonFile").onchange=e=>{
  if(e.target.files[0]) importInvoiceJSON(e.target.files[0]);
};
document.getElementById("loadInvoiceBtn").onclick=loadFromStorage;

document.getElementById("upload2D").onchange=e=>{
  Array.from(e.target.files).forEach(file=>{
    const reader=new FileReader();
    reader.onload=ev=>{
      designs.push({name:file.name,dataURL:ev.target.result});
      renderDesignList();
    };
    reader.readAsDataURL(file);
  });
};

document.getElementById("logoUpload").onchange=e=>{
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    logoDataURL=ev.target.result;
    document.getElementById("logoImg").src=logoDataURL;
  };
  reader.readAsDataURL(file);
};

// init
renderInvoiceTable();
renderDesignList();
