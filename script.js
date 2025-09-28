/* ==========================
  script.js - Updated with:
   1) client-side image resizing for logo & design
   2) invoice rows: Unit Price + Line Total (qty * unit price)
   3) capture 3D snapshot and embed in PDF (fallback: uploaded 2D)
   4) autoTable fallback, safe image type detection
==========================*/

/* ======== DOM Elements ======== */
const invoiceTbody = document.querySelector('#invoiceTable tbody');
const addRowBtn = document.getElementById('addRowBtn');
const clearRowsBtn = document.getElementById('clearRowsBtn');
const gstPercentEl = document.getElementById('gstPercent');
const totalCostEl = document.getElementById('totalCost');
const gstAmountEl = document.getElementById('gstAmount');
const finalCostEl = document.getElementById('finalCost');
const generatePDFBtn = document.getElementById('generatePDFBtn');
const logoUpload = document.getElementById('logoUpload');
const logoImg = document.getElementById('logoImg');

const upload2D = document.getElementById('upload2D');
const generate3DBtn = document.getElementById('generate3DBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const preview3D = document.getElementById('preview3D');

const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');
const importJsonFile = document.getElementById('importJsonFile');

let logoDataURL = null;
let designDataURL = null;      // uploaded 2D original (resized)
let rendered3DSnapshot = null; // snapshot from 3D renderer (dataURL) to embed in PDF

/* ======= Utilities ======= */

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getImageTypeFromDataURL(dataURL) {
  if (!dataURL) return 'PNG';
  const head = dataURL.substring(0, 30).toLowerCase();
  if (head.includes('data:image/jpeg') || head.includes('data:image/jpg')) return 'JPEG';
  if (head.includes('data:image/png')) return 'PNG';
  return 'PNG';
}

/* Resize image file to max dimensions and return dataURL (JPEG/PNG) */
function resizeImageFileToDataURL(file, maxWidth = 1200, maxHeight = 1200, mime = 'image/jpeg', quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0,0,w,h);
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const dataURL = canvas.toDataURL(mime, quality);
          resolve(dataURL);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ======= Invoice table (Unit Price + Line Total) ======= */

function createRow(item='', material='', qty=1, unitPrice=0) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input class="item" type="text" placeholder="Item" value="${escapeHtml(item)}"></td>
    <td><input class="material" type="text" placeholder="Material Used" value="${escapeHtml(material)}"></td>
    <td><input class="qty" type="number" min="0" step="1" value="${qty}"></td>
    <td><input class="unitPrice" type="number" min="0" step="0.01" value="${unitPrice}"></td>
    <td><input class="lineTotal" type="text" readonly value="${(qty * unitPrice).toFixed(2)}"></td>
    <td><button class="deleteBtn">Delete</button></td>
  `;
  invoiceTbody.appendChild(row);

  // listeners: qty or unitPrice change should update lineTotal and totals
  const qtyInput = row.querySelector('.qty');
  const upInput = row.querySelector('.unitPrice');
  const lineTotalInput = row.querySelector('.lineTotal');

  function updateLine() {
    const q = parseFloat(qtyInput.value) || 0;
    const p = parseFloat(upInput.value) || 0;
    const line = q * p;
    lineTotalInput.value = line.toFixed(2);
    recalcTotals();
  }

  qtyInput.addEventListener('input', updateLine);
  upInput.addEventListener('input', updateLine);

  row.querySelector('.deleteBtn').addEventListener('click', () => { row.remove(); recalcTotals(); });
}

addRowBtn.addEventListener('click', () => { createRow(); recalcTotals(); });
clearRowsBtn.addEventListener('click', () => { invoiceTbody.innerHTML = ''; recalcTotals(); });

/* Recalculate totals: sum of lineTotal (qty * unitPrice) */
function recalcTotals(){
  let total = 0;
  invoiceTbody.querySelectorAll('tr').forEach(row => {
    const line = parseFloat(row.querySelector('.lineTotal').value) || 0;
    total += line;
  });
  const gstPercent = parseFloat(gstPercentEl.value) || 0;
  const gstAmount = total * gstPercent / 100;
  const final = total + gstAmount;

  totalCostEl.textContent = total.toFixed(2);
  gstAmountEl.textContent = gstAmount.toFixed(2);
  finalCostEl.textContent = final.toFixed(2);
}
gstPercentEl.addEventListener('input', recalcTotals);

/* initialize: empty */
invoiceTbody.innerHTML = '';
recalcTotals();

/* ===== Logo upload with resize ===== */
logoUpload.addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  if(!f) return;
  try {
    // resize logo to reasonable size (max 300x300) and prefer PNG if input PNG else jpeg
    const mime = f.type && f.type.includes('png') ? 'image/png' : 'image/jpeg';
    logoDataURL = await resizeImageFileToDataURL(f, 600, 600, mime, 0.9);
    logoImg.src = logoDataURL;
  } catch (err) {
    console.error('Logo resize error', err);
    // fallback to raw
    const r = new FileReader();
    r.onload = e => { logoDataURL = e.target.result; logoImg.src = logoDataURL; };
    r.readAsDataURL(f);
  }
});

/* =============================
   3D Preview & snapshot capture
   - When 3D is generated we capture renderer.domElement.toDataURL and store rendered3DSnapshot
   - PDF will prefer rendered3DSnapshot (higher-fidelity) for embedding
   =============================*/
let scene, camera, renderer, controls, planeMesh;

generate3DBtn.addEventListener('click', () => {
  const file = upload2D.files[0];
  if(!file) { alert("Please upload a 2D image first."); return; }

  // Resize uploaded 2D design before using it in texture (smaller textures are fine)
  resizeImageFileToDataURL(file, 1600, 1600, 'image/jpeg', 0.85).then(dataURL => {
    designDataURL = dataURL; // resized original used for texture / fallback
    simulateProgressThenRender(designDataURL);
  }).catch(err => {
    console.warn('Resize failed, using original', err);
    const reader = new FileReader();
    reader.onload = e => { designDataURL = e.target.result; simulateProgressThenRender(designDataURL); };
    reader.readAsDataURL(file);
  });
});

function simulateProgressThenRender(url) {
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  let p = 0;
  const id = setInterval(() => {
    p += Math.random() * 18;
    if (p >= 100) p = 100;
    progressBar.style.width = `${p}%`;
    if (p === 100) {
      clearInterval(id);
      setTimeout(()=>{ progressContainer.style.display = 'none'; render3DPlane(url); }, 200);
    }
  }, 150);
}

function render3DPlane(textureURL) {
  // cleanup previous
  if(renderer) {
    try { renderer.forceContextLoss(); renderer.domElement.remove(); } catch(e){}
    renderer = null; scene = null; camera = null; controls = null; planeMesh = null;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f3f3);
  const w = preview3D.clientWidth || 600;
  const h = preview3D.clientHeight || 380;
  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(w, h);
  preview3D.innerHTML = '';
  preview3D.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.4);
  dir.position.set(0, 1, 1);
  scene.add(dir);

  const geometry = new THREE.PlaneGeometry(4, 3);
  const loader = new THREE.TextureLoader();
  const texture = loader.load(textureURL, () => { renderer.render(scene, camera); }, undefined, err=>console.error(err));
  const material = new THREE.MeshPhongMaterial({ map: texture, side: THREE.DoubleSide });
  planeMesh = new THREE.Mesh(geometry, material);
  scene.add(planeMesh);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  window.addEventListener('resize', ()=> {
    const ww = preview3D.clientWidth || 600;
    const hh = preview3D.clientHeight || 380;
    camera.aspect = ww / hh;
    camera.updateProjectionMatrix();
    renderer.setSize(ww, hh);
  });

  // animate & capture snapshot once texture is ready
  (function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  // capture a snapshot after a short delay (to allow texture to load)
  setTimeout(() => {
    try {
      // take PNG snapshot of canvas
      rendered3DSnapshot = renderer.domElement.toDataURL('image/png');
    } catch (err) {
      console.warn('3D snapshot failed', err);
      rendered3DSnapshot = null;
    }
  }, 800);
}

/* =============================
   PROFESSIONAL PDF generation
   - uses resized logoDataURL & prefers rendered3DSnapshot, else designDataURL
   - autoTable wrapped in try/catch fallback
   ============================ */
generatePDFBtn.addEventListener('click', async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  // meta
  const clientName = document.getElementById('clientName')?.value || '';
  const invoiceNumber = document.getElementById('invoiceNumber')?.value || '';
  const invoiceDate = document.getElementById('invoiceDate')?.value || new Date().toLocaleDateString();
  const gstPercent = parseFloat(gstPercentEl.value) || 0;

  // build table rows using displayed line totals
  const body = [];
  invoiceTbody.querySelectorAll('tr').forEach(row => {
    const item = row.querySelector('.item').value || '';
    const material = row.querySelector('.material').value || '';
    const qty = row.querySelector('.qty').value || '0';
    const line = row.querySelector('.lineTotal').value || '0.00';
    body.push([item, material, qty, line]);
  });

  const total = parseFloat(totalCostEl.textContent) || 0;
  const gstAmount = parseFloat(gstAmountEl.textContent) || 0;
  const final = parseFloat(finalCostEl.textContent) || 0;

  function drawHeader(data) {
    if (logoDataURL) {
      try {
        const lt = getImageTypeFromDataURL(logoDataURL);
        doc.addImage(logoDataURL, lt, margin, 18, 72, 48);
      } catch(e){}
    }
    doc.setFontSize(18);
    doc.setTextColor(20,20,20);
    doc.text("Varshith Interior Solution", pageWidth/2, 40, { align: 'center' });
    doc.setFontSize(10);
    doc.text("NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106", pageWidth/2, 56, { align: 'center' });
    doc.text("Phone: +91 9916511599 & +91 8553608981   Email: Varshithinteriorsolutions@gmail.com", pageWidth/2, 70, { align: 'center' });
  }

  function drawFooter(data) {
    const pageCount = doc.internal.getNumberOfPages();
    const pageNumber = data.pageNumber || pageCount;
    doc.setFontSize(10);
    doc.setTextColor(100);
    const footerY = pageHeight - 30;
    doc.text("Address: NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106", margin, footerY);
    doc.text("Phone: +91 9916511599 & +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com", margin, footerY + 12);
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin - 60, footerY + 6);
  }

  // draw header and invoice meta before table
  drawHeader({});
  const infoY = 90;
  const rightX = pageWidth - margin - 200;
  doc.setFontSize(10);
  if (invoiceNumber) doc.text(`Invoice No: ${invoiceNumber}`, rightX, infoY);
  if (invoiceDate) doc.text(`Date: ${invoiceDate}`, rightX, infoY + 12);
  if (clientName) doc.text(`Client: ${clientName}`, rightX, infoY + 24);

  const topStartY = 110;
  // Draw table (autoTable with fallback)
  try {
    doc.autoTable({
      head: [['Item','Material Used','Qty','Amount']],
      body,
      startY: topStartY,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
      headStyles: { fillColor: [46,125,50], textColor: 255, halign: 'center' },
      columnStyles: { 0:{cellWidth:150},1:{cellWidth:240},2:{cellWidth:50,halign:'center'},3:{cellWidth:80,halign:'right'} },
      didDrawPage: function(data){ drawHeader(data); drawFooter(data); },
      margin: { top: topStartY - 30, bottom: 110 }
    });
  } catch (err) {
    console.error('autoTable error', err);
    // fallback simple render
    let y = topStartY;
    const lineH = 14;
    doc.setFontSize(10);
    doc.text(['Item','Material Used','Qty','Amount'].join('   '), margin, y);
    y += lineH;
    for (const r of body) {
      if (y > pageHeight - 100) { doc.addPage(); drawHeader({}); drawFooter({ pageNumber: doc.internal.getNumberOfPages() }); y = 80; }
      doc.text(r.join('   '), margin, y);
      y += lineH;
    }
    doc.lastAutoTable = { finalY: y };
  }

  // totals on last page
  let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 12 : topStartY + 20;
  if (finalY + 120 > pageHeight - 40) {
    doc.addPage();
    drawHeader({});
    drawFooter({ pageNumber: doc.internal.getNumberOfPages() });
    finalY = 80;
  }

  const totalsX = pageWidth - margin - 220;
  doc.setFontSize(11); doc.setTextColor(30); doc.text("Summary", totalsX, finalY);
  doc.setFontSize(10);
  doc.text(`Total Cost:`, totalsX, finalY + 18); doc.text(`${(total).toFixed(2)}`, totalsX + 140, finalY + 18, { align: 'right' });
  doc.text(`GST (${gstPercent}%):`, totalsX, finalY + 36); doc.text(`${(gstAmount).toFixed(2)}`, totalsX + 140, finalY + 36, { align: 'right' });
  doc.setFont(undefined,'bold'); doc.text(`Final Cost:`, totalsX, finalY + 56); doc.text(`${(final).toFixed(2)}`, totalsX + 140, finalY + 56, { align: 'right' }); doc.setFont(undefined,'normal');

  // Place note (small gap)
  const noteText = document.getElementById('note').value || "";
  const smallGap = 6;
  let noteY = finalY + smallGap;
  if (noteY + 80 > pageHeight - 40) {
    doc.addPage(); drawHeader({}); drawFooter({ pageNumber: doc.internal.getNumberOfPages() }); const newPageNoteY = 80;
    doc.setFontSize(10); doc.text("Note:", margin, newPageNoteY); doc.text(noteText, margin, newPageNoteY + smallGap, { maxWidth: pageWidth - 2*margin });
    noteY = newPageNoteY + smallGap;
  } else {
    doc.setFontSize(10); doc.text("Note:", margin, noteY); doc.text(noteText, margin, noteY + smallGap, { maxWidth: pageWidth - 2*margin - 20 });
  }

  // After Note: embed rendered3DSnapshot if available else designDataURL (resized), else skip
  const embedURL = rendered3DSnapshot || designDataURL;
  if (embedURL) {
    let imageY = noteY + 40, imageX = margin, imageW = 260, imageH = 180;
    if (imageY + imageH > pageHeight - 40) { doc.addPage(); drawHeader({}); drawFooter({ pageNumber: doc.internal.getNumberOfPages() }); imageY = 80; }
    try {
      const typ = getImageTypeFromDataURL(embedURL);
      doc.addImage(embedURL, typ, imageX, imageY, imageW, imageH);
    } catch (e) { console.warn('Embed failed', e); }
  }

  doc.save(`Invoice_${invoiceNumber || Date.now()}.pdf`);
});

/* ============= Import / Export JSON ============= */
if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', () => {
    const rows = [];
    invoiceTbody.querySelectorAll('tr').forEach(r => {
      rows.push({
        item: r.querySelector('.item').value,
        material: r.querySelector('.material').value,
        qty: r.querySelector('.qty').value,
        unitPrice: r.querySelector('.unitPrice') ? r.querySelector('.unitPrice').value : '',
        lineTotal: r.querySelector('.lineTotal').value
      });
    });
    const payload = {
      clientName: document.getElementById('clientName')?.value || '',
      invoiceNumber: document.getElementById('invoiceNumber')?.value || '',
      invoiceDate: document.getElementById('invoiceDate')?.value || '',
      gst: gstPercentEl.value,
      rows,
      logoDataURL,
      designDataURL,
      rendered3DSnapshot
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `invoice_${payload.invoiceNumber || Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove();
  });
}

if (importJsonBtn) {
  importJsonBtn.addEventListener('click', () => importJsonFile.click());
}
if (importJsonFile) {
  importJsonFile.addEventListener('change', (ev) => {
    const f = ev.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = e => {
      try {
        const obj = JSON.parse(e.target.result);
        invoiceTbody.innerHTML = '';
        (obj.rows || []).forEach(rw => createRow(rw.item, rw.material, rw.qty, rw.unitPrice || 0));
        if(obj.gst) gstPercentEl.value = obj.gst;
        if(obj.clientName) document.getElementById('clientName').value = obj.clientName;
        if(obj.invoiceNumber) document.getElementById('invoiceNumber').value = obj.invoiceNumber;
        if(obj.invoiceDate) document.getElementById('invoiceDate').value = obj.invoiceDate;
        if(obj.logoDataURL) { logoDataURL = obj.logoDataURL; logoImg.src = logoDataURL; }
        if(obj.designDataURL) designDataURL = obj.designDataURL;
        if(obj.rendered3DSnapshot) rendered3DSnapshot = obj.rendered3DSnapshot;
        recalcTotals();
      } catch(err) { alert('Invalid JSON file'); }
    };
    r.readAsText(f);
  });
}
