/* ======= DOM Elements ======= */
const invoiceTbody=document.querySelector('#invoiceTable tbody');
const addRowBtn=document.getElementById('addRowBtn');
const clearRowsBtn=document.getElementById('clearRowsBtn');
const gstPercentEl=document.getElementById('gstPercent');
const totalCostEl=document.getElementById('totalCost');
const gstAmountEl=document.getElementById('gstAmount');
const finalCostEl=document.getElementById('finalCost');
const generatePDFBtn=document.getElementById('generatePDFBtn');
const logoUpload=document.getElementById('logoUpload');
const logoImg=document.getElementById('logoImg');
const upload2D=document.getElementById('upload2D');
const designListEl=document.getElementById('designList');
const progressContainer=document.getElementById('progressContainer');
const progressBar=document.getElementById('progressBar');
const preview3D=document.getElementById('preview3D');
const exportJsonBtn=document.getElementById('exportJsonBtn');
const importJsonBtn=document.getElementById('importJsonBtn');
const importJsonFile=document.getElementById('importJsonFile');
const clientNameEl=document.getElementById('clientName');
const invoiceNumberEl=document.getElementById('invoiceNumber');
const invoiceDateEl=document.getElementById('invoiceDate');
const clientGSTEl=document.getElementById('clientGST');
const paymentNoteEl=document.getElementById('paymentNote');
const recoverInvoiceBtn=document.getElementById('recoverInvoiceBtn');

let logoDataURL=null;
let designs=[];
function escapeHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function uid(prefix='id'){return prefix+Math.random().toString(36).slice(2,9);}
function getImageTypeFromDataURL(dataURL){if(!dataURL) return 'PNG';const h=dataURL.substring(0,30).toLowerCase();if(h.includes('jpeg')||h.includes('jpg')) return 'JPEG';return 'PNG';}

/* ===== Image resize helper ===== */
function resizeImageFileToDataURL(file,maxW=1200,maxH=1200,mime='image/jpeg',quality=0.8){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(new Error('read error'));
    r.onload=()=>{ const img=new Image(); img.onload=()=>{ let w=img.width,h=img.height; const ratio=Math.min(maxW/w,maxH/h,1); w=Math.round(w*ratio); h=Math.round(h*ratio); const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(img,0,0,w,h); try{const dataURL=canvas.toDataURL(mime,quality);resolve(dataURL);}catch(e){reject(e);}}; img.onerror=()=>reject(new Error('invalid image')); img.src=r.result; };
    r.readAsDataURL(file);
  });
}

/* ===== Invoice Table ===== */
function createRow(item='',material='',qty=1,unitPrice=0){
  const tr=document.createElement('tr');
  tr.innerHTML=`<td><input class="item" type="text" value="${escapeHtml(item)}"></td>
  <td><input class="material" type="text" value="${escapeHtml(material)}"></td>
  <td><input class="qty" type="number" min="0" step="1" value="${qty}"></td>
  <td><input class="unitPrice" type="number" min="0" step="0.01" value="${unitPrice}"></td>
  <td><input class="amount" type="text" readonly value="${(qty*unitPrice).toFixed(2)}"></td>
  <td><button class="deleteBtn">Delete</button></td>`;
  invoiceTbody.appendChild(tr);
  const qtyEl=tr.querySelector('.qty'), upEl=tr.querySelector('.unitPrice'), amountEl=tr.querySelector('.amount');
  function updateLine(){ const q=parseFloat(qtyEl.value)||0,p=parseFloat(upEl.value)||0; amountEl.value=(q*p).toFixed(2); recalcTotals(); }
  qtyEl.addEventListener('input',updateLine);
  upEl.addEventListener('input',updateLine);
  tr.querySelector('.deleteBtn').addEventListener('click',()=>{ tr.remove(); recalcTotals(); });
}
addRowBtn.addEventListener('click',()=>{ createRow(); recalcTotals(); });
clearRowsBtn.addEventListener('click',()=>{
  invoiceTbody.innerHTML='';
  clientNameEl.value=''; invoiceNumberEl.value=''; invoiceDateEl.value=''; clientGSTEl.value='';
  designs=[]; renderDesignList();
  recalcTotals();
});
function recalcTotals(){
  let total=0; invoiceTbody.querySelectorAll('tr').forEach(tr=>{ total+=parseFloat(tr.querySelector('.amount').value)||0; });
  const gstPercent=parseFloat(gstPercentEl.value)||0;
  const gstAmount=total*gstPercent/100;
  const final=total+gstAmount;
  totalCostEl.textContent=total.toFixed(2);
  gstAmountEl.textContent=gstAmount.toFixed(2);
  finalCostEl.textContent=final.toFixed(2);
}
gstPercentEl.addEventListener('input',recalcTotals);
invoiceTbody.innerHTML=''; recalcTotals();

/* ===== Logo Upload ===== */
logoUpload.addEventListener('change',async ev=>{
  const f=ev.target.files[0]; if(!f) return;
  try{ logoDataURL=await resizeImageFileToDataURL(f,600,600,f.type.includes('png')?'image/png':'image/jpeg',0.9); logoImg.src=logoDataURL; }
  catch(e){ const r=new FileReader(); r.onload=e=>{logoDataURL=e.target.result;logoImg.src=logoDataURL}; r.readAsDataURL(f);}
});

/* ===== Designs Upload ===== */
upload2D.addEventListener('change',async ev=>{
  const files=Array.from(ev.target.files||[]);
  for(const f of files){
    const id=uid('design_'), fileName=f.name;
    let dataURL=null;
    try{ dataURL=await resizeImageFileToDataURL(f,1600,1600,'image/jpeg',0.85); }
    catch(e){ const r=new FileReader(); dataURL=await new Promise((res,rej)=>{ r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsDataURL(f); }); }
    designs.push({id,name:fileName,fileName,dataURL,snapshot:null});
    renderDesignList();
  }
  upload2D.value='';
});
function renderDesignList(){
  designListEl.innerHTML='';
  designs.forEach(d=>{
    const div=document.createElement('div'); div.className='design-item';
    div.innerHTML=`<img class="design-thumb" src="${escapeHtml(d.dataURL)}" alt="${escapeHtml(d.name)}"/>
    <div class="design-info"><input class="design-name" value="${escapeHtml(d.name)}"/>
    <div class="design-controls"><button class="gen3dBtn">Generate 3D</button><button class="removeBtn">Remove</button></div></div>`;
    const nameInput=div.querySelector('.design-name');
    nameInput.addEventListener('input',e=>{ d.name=e.target.value; });
    div.querySelector('.gen3dBtn').addEventListener('click',()=>generate3DForDesign(d.id));
    div.querySelector('.removeBtn').addEventListener('click',()=>{ designs=designs.filter(x=>x.id!==d.id); renderDesignList(); });
    designListEl.appendChild(div);
  });
}
async function generate3DForDesign(id){
  const d=designs.find(x=>x.id===id); if(!d) return;
  progressContainer.style.display='block'; progressBar.style.width='0%';
  await new Promise(r=>setTimeout(r,300)); progressBar.style.width='50%';
  d.snapshot=d.dataURL; // For now snapshot is same as 2D
  progressBar.style.width='100%';
  renderDesignList();
  setTimeout(()=>{ progressContainer.style.display='none'; progressBar.style.width='0%'; },300);
}

/* ===== Invoice Save & Recover ===== */
function getAllInvoices(){ const s=localStorage.getItem('invoices'); return s?JSON.parse(s):{}; }
function saveInvoice(invoice){
  const inv=getAllInvoices();
  if(inv[invoice.invoiceNumber]) throw new Error('Invoice number already exists!');
  inv[invoice.invoiceNumber]=invoice;
  localStorage.setItem('invoices',JSON.stringify(inv));
}
recoverInvoiceBtn.addEventListener('click',()=>{
  const num=invoiceNumberEl.value.trim(); if(!num) return alert('Enter invoice number to recover');
  const inv=getAllInvoices()[num]; if(!inv) return alert('Invoice not found');
  clientNameEl.value=inv.clientName||''; clientGSTEl.value=inv.clientGST||''; invoiceDateEl.value=inv.invoiceDate||'';
  invoiceTbody.innerHTML='';
  inv.items?.forEach(i=>createRow(i.item,i.material,i.qty,i.unitPrice));
  designs=inv.designs||[];
  renderDesignList();
  recalcTotals();
});

/* ===== Generate PDF ===== */
generatePDFBtn.addEventListener('click',async ()=>{
  if(!invoiceNumberEl.value.trim()) return alert('Invoice number required');
  try{ saveInvoice({
    invoiceNumber:invoiceNumberEl.value.trim(),
    clientName:clientNameEl.value,
    clientGST:clientGSTEl.value,
    invoiceDate:invoiceDateEl.value,
    items:Array.from(invoiceTbody.querySelectorAll('tr')).map(tr=>({
      item:tr.querySelector('.item').value,
      material:tr.querySelector('.material').value,
      qty:tr.querySelector('.qty').value,
      unitPrice:tr.querySelector('.unitPrice').value
    })),
    designs,
    gstPercent:gstPercentEl.value,
    paymentNote:paymentNoteEl.value
  }); }catch(e){ return alert(e.message); }

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();
  const margin=40;
  const lineHeight=18;
  const startY=60;

  /* Watermark */
  doc.setFontSize(60); doc.setTextColor(200,200,200); doc.setFont('helvetica','bold');
  doc.text('Varshith Interior Solutions',pageWidth/2,pageHeight/2,{align:'center',angle:45});

  /* Header */
  if(logoDataURL) doc.addImage(logoDataURL,'PNG',margin,10,50,50);
  doc.setFontSize(16); doc.setTextColor(0,0,128);
  doc.text('Varshith Interior Solutions',margin+60,30);
  doc.setFontSize(10); doc.setTextColor(0,0,0);
  doc.text('NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi, Anekal - 562106',margin+60,45);
  doc.text('Phone: +91 9916511599 & +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com',margin+60,60);

  let y=startY;

  /* Invoice Info */
  doc.setFontSize(12); doc.setTextColor(0,0,0);
  doc.text(`Invoice No: ${invoiceNumberEl.value}`,margin,y); y+=lineHeight;
  doc.text(`Date: ${invoiceDateEl.value}`,margin,y); y+=lineHeight;
  doc.text(`Client Name: ${clientNameEl.value}`,margin,y); y+=lineHeight;
  doc.text(`Client GST: ${clientGSTEl.value}`,margin,y); y+=lineHeight;
  doc.text(`GST %: ${gstPercentEl.value}`,margin,y); y+=lineHeight;

  /* Items Table */
  const columns=['Item','Material','Qty','Unit Price','Amount'];
  const rows=Array.from(invoiceTbody.querySelectorAll('tr')).map(tr=>[
    tr.querySelector('.item').value,
    tr.querySelector('.material').value,
    tr.querySelector('.qty').value,
    tr.querySelector('.unitPrice').value,
    tr.querySelector('.amount').value
  ]);
  doc.autoTable({head:[columns],body:rows,startY:y,margin:{left:margin},theme:'grid',headStyles:{fillColor:[46,125,50]}});

  y=doc.lastAutoTable.finalY+10;
  doc.text(`Total Cost: ${totalCostEl.textContent}`,margin,y); y+=lineHeight;
  doc.text(`GST: ${gstAmountEl.textContent}`,margin,y); y+=lineHeight;
  doc.text(`Final Cost: ${finalCostEl.textContent}`,margin,y); y+=lineHeight;

  /* Payment Note */
  doc.text(paymentNoteEl.value,margin,y); y+=lineHeight*2;

  /* Designs */
  for(const d of designs){
    if(d.snapshot){
      if(y+150>pageHeight-50) doc.addPage(),y=50;
      doc.text(d.name,margin,y); y+=lineHeight;
      doc.addImage(d.snapshot,getImageTypeFromDataURL(d.snapshot),margin,y,150,100);
      y+=110;
    }
  }

  /* Footer */
  const pageCount=doc.internal.getNumberOfPages();
  for(let i=1;i<=pageCount;i++){
    doc.setPage(i);
    doc.setFontSize(10); doc.setTextColor(100,100,100);
    doc.text(`Page ${i} of ${pageCount}`,pageWidth-100,pageHeight-30);
    doc.setFontSize(10); doc.setTextColor(0,0,0);
    doc.text('Address: NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106',margin,pageHeight-50);
    doc.text('Phone: +91 9916511599 & +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com',margin,pageHeight-35);
  }

  doc.save(`Invoice_${invoiceNumberEl.value}.pdf`);
});

/* ===== JSON Export/Import ===== */
exportJsonBtn.addEventListener('click',()=>{
  const inv={
    invoiceNumber:invoiceNumberEl.value,
    clientName:clientNameEl.value,
    clientGST:clientGSTEl.value,
    invoiceDate:invoiceDateEl.value,
    items:Array.from(invoiceTbody.querySelectorAll('tr')).map(tr=>({
      item:tr.querySelector('.item').value,
      material:tr.querySelector('.material').value,
      qty:tr.querySelector('.qty').value,
      unitPrice:tr.querySelector('.unitPrice').value
    })),
    designs,
    gstPercent:gstPercentEl.value,
    paymentNote:paymentNoteEl.value
  };
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(inv,null,2)],{type:'application/json'}));
  a.download=`Invoice_${invoiceNumberEl.value}.json`; a.click();
});
importJsonBtn.addEventListener('click',()=>importJsonFile.click());
importJsonFile.addEventListener('change',ev=>{
  const f=ev.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=e=>{
    try{
      const inv=JSON.parse(e.target.result);
      clientNameEl.value=inv.clientName||'';
      clientGSTEl.value=inv.clientGST||'';
      invoiceNumberEl.value=inv.invoiceNumber||'';
      invoiceDateEl.value=inv.invoiceDate||'';
      gstPercentEl.value=inv.gstPercent||18;
      invoiceTbody.innerHTML=''; inv.items?.forEach(i=>createRow(i.item,i.material,i.qty,i.unitPrice));
      designs=inv.designs||[]; renderDesignList(); recalcTotals();
    }catch(err){ alert('Invalid JSON file'); }
  };
  r.readAsText(f);
});
