// DOM Elements
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
const designListEl = document.getElementById('designList');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const preview3D = document.getElementById('preview3D');

const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');
const importJsonFile = document.getElementById('importJsonFile');

let logoDataURL = null;
let designs = [];

// Utilities
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function uid(prefix='id'){ return prefix + Math.random().toString(36).slice(2,9); }
function getImageTypeFromDataURL(dataURL){ if(!dataURL) return 'PNG'; const h = dataURL.substring(0,30).toLowerCase(); if(h.includes('jpeg')||h.includes('jpg')) return 'JPEG'; if(h.includes('png')) return 'PNG'; return 'PNG'; }

// Add Row
function createRow(item='', material='', qty=1, unitPrice=0){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="item" type="text" value="${escapeHtml(item)}"></td>
    <td><input class="material" type="text" value="${escapeHtml(material)}"></td>
    <td><input class="qty" type="number" min="0" step="1" value="${qty}"></td>
    <td><input class="unitPrice" type="number" min="0" step="0.01" value="${unitPrice}"></td>
    <td><input class="amount" type="text" readonly value="${(qty*unitPrice).toFixed(2)}"></td>
    <td><button class="deleteBtn">Delete</button></td>
  `;
  invoiceTbody.appendChild(tr);

  const qtyEl = tr.querySelector('.qty');
  const upEl = tr.querySelector('.unitPrice');
  const amountEl = tr.querySelector('.amount');
  function updateLine(){ 
    const q = parseFloat(qtyEl.value)||0;
    const p = parseFloat(upEl.value)||0;
    amountEl.value = (q*p).toFixed(2);
    recalcTotals();
  }
  qtyEl.addEventListener('input', updateLine);
  upEl.addEventListener('input', updateLine);
  tr.querySelector('.deleteBtn').addEventListener('click', ()=>{ tr.remove(); recalcTotals(); });
}

addRowBtn.addEventListener('click', ()=>{ createRow(); recalcTotals(); });
clearRowsBtn.addEventListener('click', ()=>{ invoiceTbody.innerHTML=''; recalcTotals(); });

// Recalculate totals
function recalcTotals(){
  let total = 0;
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    total += parseFloat(tr.querySelector('.amount').value) || 0;
  });
  const gstPercent = parseFloat(gstPercentEl.value)||0;
  const gstAmount = total * gstPercent/100;
  const final = total + gstAmount;
  totalCostEl.textContent = total.toFixed(2);
  gstAmountEl.textContent = gstAmount.toFixed(2);
  finalCostEl.textContent = final.toFixed(2);
}
gstPercentEl.addEventListener('input', recalcTotals);
invoiceTbody.innerHTML=''; recalcTotals();

// Logo Upload
logoUpload.addEventListener('change', async ev=>{
  const f = ev.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = e=>{ logoDataURL=e.target.result; logoImg.src = logoDataURL; };
  r.readAsDataURL(f);
});

// 2D Design Upload
upload2D.addEventListener('change', async ev=>{
  const files = Array.from(ev.target.files||[]);
  for(const f of files){
    const id = uid('design_'); 
    const fileName = f.name;
    const r = new FileReader();
    r.onload = e=>{
      designs.push({id,name:fileName,fileName,dataURL:e.target.result,snapshot:null});
      renderDesignList();
    };
    r.readAsDataURL(f);
  }
  upload2D.value='';
});

// Render Design List
function renderDesignList(){
  designListEl.innerHTML='';
  designs.forEach(d=>{
    const div=document.createElement('div'); div.className='design-item';
    div.innerHTML=`
      <img class="design-thumb" src="${escapeHtml(d.dataURL)}"/>
      <div class="design-info">
        <input class="design-name" value="${escapeHtml(d.name)}"/>
        <div class="design-controls">
          <button class="gen3dBtn">Generate 3D</button>
          <button class="removeBtn">Remove</button>
        </div>
      </div>`;
    div.querySelector('.design-name').addEventListener('input', e=>d.name=e.target.value);
    div.querySelector('.gen3dBtn').addEventListener('click', ()=> generate3DForDesign(d.id));
    div.querySelector('.removeBtn').addEventListener('click', ()=>{ designs=designs.filter(x=>x.id!==d.id); renderDesignList(); });
    designListEl.appendChild(div);
  });
}

// 3D Preview (simplified)
let globalRenderer=null, globalScene=null, globalCamera=null, globalControls=null, globalMesh=null;
function generate3DForDesign(designId){
  const entry=designs.find(d=>d.id===designId); if(!entry) return;
  progressContainer.style.display='block'; progressBar.style.width='0%';
  let p=0;
  const id=setInterval(()=>{
    p+=Math.random()*20; if(p>100) p=100; progressBar.style.width=p+'%';
    if(p===100){ clearInterval(id); setTimeout(()=>{
      progressContainer.style.display='none';
      render3DPlaneAndCapture(entry);
    },300);}
  },150);
}
function render3DPlaneAndCapture(entry){
  if(globalRenderer){ try{globalRenderer.forceContextLoss(); globalRenderer.domElement.remove();}catch(e){} globalRenderer=null; globalScene=null; globalCamera=null; globalControls=null; globalMesh=null;}
  globalScene=new THREE.Scene(); globalScene.background=new THREE.Color(0xf3f3f3);
  const w=preview3D.clientWidth||600,h=preview3D.clientHeight||380;
  globalCamera=new THREE.PerspectiveCamera(45,w/h,0.1,1000); globalCamera.position.set(0,0,5);
  globalRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  globalRenderer.setSize(w,h); preview3D.innerHTML=''; preview3D.appendChild(globalRenderer.domElement);
  const ambient=new THREE.AmbientLight(0xffffff,0.9); globalScene.add(ambient);
  const dir=new THREE.DirectionalLight(0xffffff,0.4); dir.position.set(0,1,1); globalScene.add(dir);
  const geometry=new THREE.PlaneGeometry(4,3); const loader=new THREE.TextureLoader(); const texture=loader.load(entry.dataURL);
  const material=new THREE.MeshBasicMaterial({map:texture}); globalMesh=new THREE.Mesh(geometry,material); globalScene.add(globalMesh);
  globalControls=new THREE.OrbitControls(globalCamera,globalRenderer.domElement); globalControls.update();
  globalRenderer.render(globalScene,globalCamera);
  // capture snapshot
  entry.snapshot = globalRenderer.domElement.toDataURL('image/png');
}

// Generate PDF
generatePDFBtn.addEventListener('click',()=>{
  const { jsPDF } = window.jspdf;
  const doc=new jsPDF('p','pt','a4');
  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();
  
  // Header
  doc.setFillColor(46,125,50);
  doc.rect(0,0,pageWidth,60,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(16);
  doc.text('Varshith Interior Solutions',40,30);
  if(logoDataURL) doc.addImage(logoDataURL,'PNG',pageWidth-100,5,72,50);
  
  // Client info
  doc.setFontSize(12); doc.setTextColor(0);
  doc.text(`Client: ${document.getElementById('clientName').value || ''}`,40,80);
  doc.text(`Invoice No: ${document.getElementById('invoiceNumber').value || ''}`,40,100);
  doc.text(`Date: ${document.getElementById('invoiceDate').value || ''}`,40,120);
  
  // Items Table
  const tableData=[];
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    tableData.push([
      tr.querySelector('.item').value,
      tr.querySelector('.material').value,
      tr.querySelector('.qty').value,
      tr.querySelector('.unitPrice').value,
      tr.querySelector('.amount').value
    ]);
  });
  doc.autoTable({
    head:[['Item','Material','Qty','Unit Price','Amount']],
    body:tableData,
    startY:140,
    theme:'grid',
    headStyles:{fillColor:[46,125,50],textColor:255}
  });

  // Totals
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.text(`Total Cost: ${totalCostEl.textContent}`,40,finalY);
  doc.text(`GST (${gstPercentEl.value}%): ${gstAmountEl.textContent}`,40,finalY+20);
  doc.text(`Final Cost: ${finalCostEl.textContent}`,40,finalY+40);
  doc.text(`Payment note: 50 PCT of the quoted amount has to be paid as advance, 30 PCT after completing 50 % of work and remaining 20 PCT after completion of work.`,40,finalY+60);

  // Designs
  let yPos = finalY+90;
  designs.forEach(d=>{
    if(d.snapshot){
      const imgW = 180, imgH = 120;
      if(yPos+imgH>pageHeight-60){ doc.addPage(); yPos=40; }
      doc.text(d.name,40,yPos);
      doc.addImage(d.snapshot,'PNG',40,yPos+5,imgW,imgH);
      yPos+=imgH+30;
    }
  });

  // Watermark
  doc.setFontSize(50); doc.setTextColor(200,200,200); doc.text('Varshith Interior Solutions',pageWidth/2, pageHeight/2,{angle:45,align:'center',baseline:'middle'});

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for(let i=1;i<=pageCount;i++){
    doc.setPage(i);
    doc.setFillColor(46,125,50); doc.rect(0,pageHeight-30,pageWidth,30,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(10);
    doc.text(`Page ${i} of ${pageCount}`,pageWidth-100,pageHeight-10);
  }

  doc.save(`Invoice_${document.getElementById('invoiceNumber').value || 'new'}.pdf`);
});

/* ===== Save / Recover Invoices ===== */
function saveInvoice(invoiceNumber){
  if(!invoiceNumber) { alert("Provide Invoice Number to save"); return; }
  const items = [];
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    items.push({
      item: tr.querySelector('.item').value || '',
      material: tr.querySelector('.material').value || '',
      qty: parseFloat(tr.querySelector('.qty').value) || 0,
      unitPrice: parseFloat(tr.querySelector('.unitPrice').value) || 0,
    });
  });
  const gstPercent = parseFloat(gstPercentEl.value)||0;
  const totalCost = parseFloat(totalCostEl.textContent)||0;
  const gstAmount = parseFloat(gstAmountEl.textContent)||0;
  const finalCost = parseFloat(finalCostEl.textContent)||0;

  const invoiceData = {
    clientName: document.getElementById('clientName')?.value || '',
    invoiceNumber,
    invoiceDate: document.getElementById('invoiceDate')?.value || new Date().toLocaleDateString(),
    logoDataURL,
    items,
    gstPercent,
    totalCost,
    gstAmount,
    finalCost,
    designs
  };

  localStorage.setItem(`invoice_${invoiceNumber}`, JSON.stringify(invoiceData));
  alert(`Invoice "${invoiceNumber}" saved successfully!`);
}

function recoverInvoice(invoiceNumber){
  const data = localStorage.getItem(`invoice_${invoiceNumber}`);
  if(!data){ alert(`Invoice "${invoiceNumber}" not found.`); return; }
  const invoice = JSON.parse(data);

  document.getElementById('clientName').value = invoice.clientName;
  document.getElementById('invoiceNumber').value = invoice.invoiceNumber;
  document.getElementById('invoiceDate').value = invoice.invoiceDate;
  logoDataURL = invoice.logoDataURL || null; logoImg.src = logoDataURL || '';

  invoiceTbody.innerHTML=''; (invoice.items||[]).forEach(it=>createRow(it.item,it.material,it.qty,it.unitPrice));
  recalcTotals();

  designs = invoice.designs||[];
  renderDesignList();
}

document.getElementById('saveInvoiceBtn')?.addEventListener('click', ()=>{
  const invoiceNumber = document.getElementById('invoiceNumber')?.value;
  saveInvoice(invoiceNumber);
});

document.getElementById('recoverInvoiceBtn')?.addEventListener('click', ()=>{
  const invoiceNumber = document.getElementById('recoverInvoiceNumber')?.value;
  recoverInvoice(invoiceNumber);
});
