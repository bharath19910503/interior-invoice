/* ==========================
  Varshith Interior Solutions Invoice & 2D→3D Designer
  Features:
  - Add/Edit/Delete invoice items
  - Calculate Total, GST, Final cost
  - Upload logo
  - Upload multiple 2D designs → generate 3D preview
  - Generate PDF with header/footer, watermark, page numbers
  - Payment note after totals
  - Recover old invoice by invoice number
  - Export/Import JSON
==========================*/

/* ===== DOM Elements ===== */
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
const recoverInvoiceBtn = document.getElementById('recoverInvoiceBtn');
const invoiceNumberInput = document.getElementById('invoiceNumber');

let logoDataURL = null;
let designs = []; // { id, name, fileName, dataURL, snapshot }

/* ===== Utilities ===== */
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function uid(prefix='id'){ return prefix + Math.random().toString(36).slice(2,9); }
function getImageTypeFromDataURL(dataURL){
  if(!dataURL) return 'PNG';
  const h = dataURL.substring(0,30).toLowerCase();
  if(h.includes('data:image/jpeg')||h.includes('data:image/jpg')) return 'JPEG';
  if(h.includes('data:image/png')) return 'PNG';
  return 'PNG';
}
function resizeImageFileToDataURL(file, maxW=1200, maxH=1200, mime='image/jpeg', quality=0.8){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onerror = ()=>reject(new Error('read error'));
    r.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        const ratio = Math.min(maxW/w, maxH/h, 1);
        w = Math.round(w*ratio); h = Math.round(h*ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);
        try{ resolve(canvas.toDataURL(mime,quality)); } catch(e){ reject(e); }
      };
      img.onerror = ()=>reject(new Error('invalid image'));
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/* ===== Invoice Table ===== */
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
  tr.querySelector('.deleteBtn').addEventListener('click', ()=>{
    tr.remove();
    recalcTotals();
  });
}

addRowBtn.addEventListener('click', ()=>{ createRow(); recalcTotals(); });
clearRowsBtn.addEventListener('click', ()=>{ invoiceTbody.innerHTML=''; recalcTotals(); });

function recalcTotals(){
  let total = 0;
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    total += parseFloat(tr.querySelector('.amount').value)||0;
  });
  const gstPercent = parseFloat(gstPercentEl.value)||0;
  const gstAmount = total*gstPercent/100;
  const final = total+gstAmount;
  totalCostEl.textContent = total.toFixed(2);
  gstAmountEl.textContent = gstAmount.toFixed(2);
  finalCostEl.textContent = final.toFixed(2);
}
gstPercentEl.addEventListener('input', recalcTotals);
invoiceTbody.innerHTML = ''; recalcTotals();

/* ===== Logo Upload ===== */
logoUpload.addEventListener('change', async (ev)=>{
  const f = ev.target.files[0];
  if(!f) return;
  try{
    const mime = f.type.includes('png') ? 'image/png' : 'image/jpeg';
    logoDataURL = await resizeImageFileToDataURL(f,600,600,mime,0.9);
    logoImg.src = logoDataURL;
  }catch(e){
    const r = new FileReader();
    r.onload = e=>{ logoDataURL = e.target.result; logoImg.src = logoDataURL; };
    r.readAsDataURL(f);
  }
});

/* ===== 2D→3D Designer ===== */
upload2D.addEventListener('change', async ev=>{
  const files = Array.from(ev.target.files || []);
  for(const f of files){
    const id = uid('design_'); const fileName=f.name;
    let dataURL = null;
    try{ dataURL = await resizeImageFileToDataURL(f,1600,1600,'image/jpeg',0.85);} 
    catch(e){ 
      const r = new FileReader();
      dataURL = await new Promise((res,rej)=>{ r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsDataURL(f);});
    }
    designs.push({id,name:fileName,fileName,dataURL,snapshot:null});
    renderDesignList();
  }
  upload2D.value='';
});

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
      </div>
    `;
    const nameInput = div.querySelector('.design-name');
    nameInput.addEventListener('input', e=>{ d.name = e.target.value; });

    div.querySelector('.gen3dBtn').addEventListener('click', ()=> generate3DForDesign(d.id));
    div.querySelector('.removeBtn').addEventListener('click', ()=>{
      designs = designs.filter(x=>x.id!==d.id);
      renderDesignList();
    });
    designListEl.appendChild(div);
  });
}

/* ===== 3D Preview & Snapshot ===== */
let globalRenderer=null, globalScene=null, globalCamera=null, globalControls=null, globalMesh=null;

async function generate3DForDesign(designId){
  const entry=designs.find(d=>d.id===designId);
  if(!entry){ alert('Design not found'); return; }
  progressContainer.style.display='block'; progressBar.style.width='0%';
  let p=0;
  const id = setInterval(()=>{
    p+=Math.random()*18; if(p>100)p=100;
    progressBar.style.width=p+'%';
    if(p===100){ clearInterval(id); setTimeout(()=>{ progressContainer.style.display='none'; render3DPlaneAndCapture(entry);},200);}
  },150);
}

function render3DPlaneAndCapture(entry){
  if(globalRenderer){
    try{ globalRenderer.forceContextLoss(); globalRenderer.domElement.remove(); }catch(e){}
    globalRenderer=null; globalScene=null; globalCamera=null; globalControls=null; globalMesh=null;
  }
  globalScene=new THREE.Scene(); globalScene.background=new THREE.Color(0xf3f3f3);
  const w=preview3D.clientWidth||600; const h=preview3D.clientHeight||380;
  globalCamera=new THREE.PerspectiveCamera(45,w/h,0.1,1000);
  globalCamera.position.set(0,0,5);
  globalRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  globalRenderer.setSize(w,h);
  preview3D.innerHTML=''; preview3D.appendChild(globalRenderer.domElement);

  const ambient=new THREE.AmbientLight(0xffffff,0.9); globalScene.add(ambient);
  const dir=new THREE.DirectionalLight(0xffffff,0.4); dir.position.set(0,1,1); globalScene.add(dir);

  const geometry=new THREE.PlaneGeometry(4,3);
  const loader=new THREE.TextureLoader();
  const texture=loader.load(entry.dataURL, ()=>{ globalRenderer.render(globalScene, globalCamera); });
  const material=new THREE.MeshPhongMaterial({map:texture,side:THREE.DoubleSide});
  globalMesh=new THREE.Mesh(geometry,material); globalScene.add(globalMesh);

  globalControls=new THREE.OrbitControls(globalCamera, globalRenderer.domElement);
  globalControls.enableDamping=true; globalControls.dampingFactor=0.08;

  function animate(){ requestAnimationFrame(animate); globalControls.update(); globalRenderer.render(globalScene,globalCamera);}
  animate();

  setTimeout(()=>{
    try{ entry.snapshot = globalRenderer.domElement.toDataURL('image/png'); }catch(e){ entry.snapshot=null; }
    renderDesignList();
    alert(`3D generated for "${entry.name}"`);
  },800);
}

/* ===== PDF Generation ===== */
generatePDFBtn.addEventListener('click', async ()=>{
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','pt','a4');
  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(46,125,50); doc.rect(0,0,pageWidth,60,'F');
  doc.setFontSize(20); doc.setTextColor(255,255,255);
  doc.text('Varshith Interior Solutions',40,35);
  doc.setFontSize(10);
  doc.text('NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi, Anekal - 562106',40,50);
  doc.text('Phone: +91 9916511599 | +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com',pageWidth-40,35,{align:'right'});

  // Logo
  if(logoDataURL) doc.addImage(logoDataURL,'PNG',pageWidth-100,10,60,60);

  let y = 70;

  doc.setFontSize(12); doc.setTextColor(0,0,0);
  doc.text(`Client Name: ${escapeHtml(document.getElementById('clientName').value)}`,40,y);
  doc.text(`Invoice Number: ${escapeHtml(document.getElementById('invoiceNumber').value)}`,pageWidth-40,y,{align:'right'});
  y+=20;
  doc.text(`Invoice Date: ${document.getElementById('invoiceDate').value}`,40,y); y+=15;

  // Table
  const tableBody = [];
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    const cells = [
      tr.querySelector('.item').value,
      tr.querySelector('.material').value,
      tr.querySelector('.qty').value,
      tr.querySelector('.unitPrice').value,
      tr.querySelector('.amount').value
    ];
    tableBody.push(cells);
  });

  doc.autoTable({
    startY:y,
    head:[['Item','Material','Qty','Unit Price','Amount']],
    body:tableBody,
    theme:'grid',
    headStyles:{fillColor:[46,125,50],textColor:255},
    styles:{cellPadding:3,fontSize:10}
  });

  y = doc.lastAutoTable.finalY + 10;
  doc.text(`Total Cost: ${totalCostEl.textContent}`,40,y); y+=12;
  doc.text(`GST (${gstPercentEl.value}%): ${gstAmountEl.textContent}`,40,y); y+=12;
  doc.text(`Final Cost: ${finalCostEl.textContent}`,40,y); y+=20;

  doc.text(`Payment note: 50 PCT of the quoted amount has to be paid as advance, 30 PCT after completing 50 % of work and remaining 20 PCT after the completion of work.`,40,y,{maxWidth:pageWidth-80});
  y+=30;

  // Designs
  for(const d of designs){
    if(d.snapshot){
      if(y+80>pageHeight-40){ doc.addPage(); y=40; }
      doc.text(d.name,40,y); y+=12;
      doc.addImage(d.snapshot,'PNG',40,y,200,150); y+=160;
    }
  }

  // Footer with page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for(let i=1;i<=pageCount;i++){
    doc.setPage(i);
    doc.setFillColor(46,125,50); doc.rect(0,pageHeight-40,pageWidth,40,'F');
    doc.setFontSize(10); doc.setTextColor(255,255,255);
    doc.text(`Page ${i} of ${pageCount}`,pageWidth-50,pageHeight-20);
    doc.text('© 2025 Varshith Interior Solutions',40,pageHeight-20);
  }

  // Watermark
  doc.setFontSize(60); doc.setTextColor(200,200,200); doc.setTextColor(200,200,200,0.2);
  doc.text('Varshith Interior Solutions',pageWidth/2, pageHeight/2,{align:'center',angle:45,baseline:'middle'});

  doc.save(`Invoice_${invoiceNumberInput.value || Date.now()}.pdf`);

  // Save in localStorage
  saveInvoiceToLocal();
});

/* ===== Save & Recover Invoice ===== */
function getInvoiceData(){
  return {
    clientName: document.getElementById('clientName').value,
    invoiceNumber: invoiceNumberInput.value,
    invoiceDate: document.getElementById('invoiceDate').value,
    gstPercent: gstPercentEl.value,
    items: Array.from(invoiceTbody.querySelectorAll('tr')).map(tr=>({
      item: tr.querySelector('.item').value,
      material: tr.querySelector('.material').value,
      qty: tr.querySelector('.qty').value,
      unitPrice: tr.querySelector('.unitPrice').value
    })),
    logo: logoDataURL,
    designs: designs
  };
}

function saveInvoiceToLocal(){
  const data = getInvoiceData();
  if(!data.invoiceNumber){ alert('Invoice number required to save'); return; }
  localStorage.setItem('invoice_'+data.invoiceNumber, JSON.stringify(data));
}

recoverInvoiceBtn.addEventListener('click', ()=>{
  const invNo = invoiceNumberInput.value;
  if(!invNo){ alert('Enter invoice number'); return; }
  const stored = localStorage.getItem('invoice_'+invNo);
  if(!stored){ alert('No invoice found'); return; }
  const data = JSON.parse(stored);
  document.getElementById('clientName').value = data.clientName;
  document.getElementById('invoiceDate').value = data.invoiceDate;
  gstPercentEl.value = data.gstPercent;
  logoDataURL = data.logo;
  logoImg.src = logoDataURL;
  invoiceTbody.innerHTML=''; data.items.forEach(it=>createRow(it.item,it.material,it.qty,it.unitPrice));
  designs = data.designs || [];
  renderDesignList();
  recalcTotals();
});

/* ===== Export/Import JSON ===== */
exportJsonBtn.addEventListener('click', ()=>{
  const data = getInvoiceData();
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download = `Invoice_${invoiceNumberInput.value||Date.now()}.json`;
  a.click();
});

importJsonBtn.addEventListener('click', ()=>{ importJsonFile.click(); });
importJsonFile.addEventListener('change', async ev=>{
  const f = ev.target.files[0]; if(!f) return;
  const text = await f.text(); const data = JSON.parse(text);
  document.getElementById('clientName').value = data.clientName;
  invoiceNumberInput.value = data.invoiceNumber;
  document.getElementById('invoiceDate').value = data.invoiceDate;
  gstPercentEl.value = data.gstPercent;
  logoDataURL = data.logo; logoImg.src=logoDataURL;
  invoiceTbody.innerHTML=''; data.items.forEach(it=>createRow(it.item,it.material,it.qty,it.unitPrice));
  designs = data.designs||[];
  renderDesignList(); recalcTotals();
});
