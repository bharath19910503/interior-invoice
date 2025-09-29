/* ========================== FULL WORKING SCRIPT ========================== */

const invoiceTbody = document.querySelector('#invoiceTable tbody');
const addRowBtn = document.getElementById('addRowBtn');
const clearRowsBtn = document.getElementById('clearRowsBtn');
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
const clientGSTEl = document.getElementById('clientGST');
const ourGSTEl = document.getElementById('ourGST');

let logoDataURL = null;
let designs = [];

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function uid(prefix='id'){ return prefix + Math.random().toString(36).slice(2,9); }

function resizeImageFileToDataURL(file, maxW=1200, maxH=1200, mime='image/jpeg', quality=0.8){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onerror = ()=>reject(new Error('read error'));
    r.onload = ()=> {
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        const ratio = Math.min(maxW/w, maxH/h, 1);
        w = Math.round(w*ratio); h = Math.round(h*ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);
        try { const dataURL = canvas.toDataURL(mime, quality); resolve(dataURL); } 
        catch(e){ reject(e); }
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
  const unitPriceEl = tr.querySelector('.unitPrice');
  const amountEl = tr.querySelector('.amount');
  qtyEl.addEventListener('input', ()=>{ amountEl.value=(qtyEl.value*unitPriceEl.value).toFixed(2); updateSummary(); });
  unitPriceEl.addEventListener('input', ()=>{ amountEl.value=(qtyEl.value*unitPriceEl.value).toFixed(2); updateSummary(); });
  tr.querySelector('.deleteBtn').addEventListener('click', ()=>{ tr.remove(); updateSummary(); });

  updateSummary();
}

function updateSummary(){
  const rows = [...invoiceTbody.querySelectorAll('tr')];
  let total=0;
  rows.forEach(tr=>{ const amt=parseFloat(tr.querySelector('.amount').value)||0; total+=amt; });
  const gst = 0; // GST hidden
  totalCostEl.textContent = total.toFixed(2);
  gstAmountEl.textContent = gst.toFixed(2);
  finalCostEl.textContent = (total+gst).toFixed(2);
}

/* ===== Logo Upload ===== */
logoUpload.addEventListener('change', async(e)=>{
  const file = e.target.files[0]; if(!file) return;
  logoDataURL = await resizeImageFileToDataURL(file,300,300);
  logoImg.src = logoDataURL;
});

/* ===== Add / Clear Row ===== */
addRowBtn.addEventListener('click', ()=>createRow());
clearRowsBtn.addEventListener('click', ()=>{
  invoiceTbody.innerHTML='';
  document.getElementById('clientName').value='';
  document.getElementById('invoiceNumber').value='';
  document.getElementById('invoiceDate').value='';
  clientGSTEl.value='';
  ourGSTEl.value='';
  designs=[];
  designListEl.innerHTML='';
  logoImg.src='';
  logoDataURL=null;
  updateSummary();
});

/* ===== Design Upload & 3D ===== */
upload2D.addEventListener('change', async(e)=>{
  const files=[...e.target.files];
  for(const file of files){
    const dataURL=await resizeImageFileToDataURL(file,300,300);
    const id=uid('design_');
    const div=document.createElement('div');
    div.className='design-item';
    div.dataset.id=id;
    div.innerHTML=`
      <img class="design-thumb" src="${dataURL}">
      <div class="design-info">
        <input type="text" class="design-name" value="${escapeHtml(file.name)}">
      </div>
      <div class="design-controls">
        <button class="gen3DBtn">Generate 3D</button>
      </div>
    `;
    designListEl.appendChild(div);
    const designObj={id, name:file.name, dataURL:null};
    designs.push(designObj);

    div.querySelector('.gen3DBtn').addEventListener('click', ()=>{
      // For simplicity, we just use 2D image as "3D snapshot"
      designObj.dataURL=dataURL;
      preview3D.style.backgroundImage=`url(${dataURL})`;
      preview3D.style.backgroundSize='contain';
      preview3D.style.backgroundRepeat='no-repeat';
      preview3D.style.backgroundPosition='center';
    });
  }
});

/* ===== Generate PDF ===== */
generatePDFBtn.addEventListener('click', async()=>{
  const invoiceNumber=document.getElementById('invoiceNumber').value.trim();
  if(!invoiceNumber){ alert('Enter invoice number'); return; }

  // Duplicate check
  const savedInvoices=JSON.parse(localStorage.getItem('invoices')||'{}');
  if(savedInvoices[invoiceNumber]){
    alert('Invoice number already exists!');
    return;
  }

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();

  /* ===== Header ===== */
  doc.setFillColor(21,101,192);
  doc.rect(0,0,pageWidth,50,'F');
  doc.setFontSize(18);
  doc.setTextColor(255,255,255);
  doc.text('Varshith Interior Solutions', 40, 30);
  if(logoDataURL) doc.addImage(logoDataURL,'JPEG',pageWidth-100,5,60,40);

  /* ===== Client Info ===== */
  doc.setFontSize(12);
  doc.setTextColor(0,0,0);
  doc.text(`Invoice No: ${invoiceNumber}`, 40, 70);
  doc.text(`Date: ${document.getElementById('invoiceDate').value}`, 200, 70);
  doc.text(`Client: ${document.getElementById('clientName').value}`, 40, 90);
  doc.text(`Client GST: ${clientGSTEl.value}`, 40, 105);

  /* ===== Table ===== */
  const rows=[...invoiceTbody.querySelectorAll('tr')].map(tr=>{
    const cells=[...tr.querySelectorAll('input')].map(input=>input.value);
    return cells.slice(0,5);
  });

  doc.autoTable({
    startY:120,
    head:[['Item','Material','Qty','Unit Price','Amount']],
    body:rows,
    theme:'grid',
    headStyles:{fillColor:[46,125,50]},
  });

  let finalY=doc.lastAutoTable.finalY+10;

  /* ===== Summary ===== */
  doc.text(`Total Cost: ${totalCostEl.textContent}`, 40, finalY);
  doc.text(`GST Amount: ${gstAmountEl.textContent}`, 40, finalY+15);
  doc.text(`Final Cost: ${finalCostEl.textContent}`, 40, finalY+30);

  /* ===== Payment Note ===== */
  doc.setFontSize(11);
  doc.text(`Payment note: 50% of the quoted amount has to be paid as advance, 30% after completing 50% of work and remaining 20% after the completion of work.`, 40, finalY+50);

  /* ===== 2D/3D Designs ===== */
  let y=finalY+70;
  for(const d of designs){
    if(d.dataURL){
      if(y+100>pageHeight-60){ doc.addPage(); y=40; }
      doc.text(`Design: ${d.name}`, 40, y);
      doc.addImage(d.dataURL,'JPEG',40,y+10,150,100);
      y+=120;
    }
  }

  /* ===== Footer ===== */
  const footerHeight=50;
  const footerText=`Address: NO 39 BRN Ashish Layout, Near Sri Thimmaraya Swami Gudi, Anekal - 562106 | Phone: +91 9916511599 & +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com | GST: ${ourGSTEl.value}`;
  const pageCount=doc.internal.getNumberOfPages();
  for(let i=1;i<=pageCount;i++){
    doc.setPage(i);
    doc.setFillColor(46,125,50);
    doc.rect(0,pageHeight-footerHeight,pageWidth,footerHeight,'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(10);
    doc.text(footerText,40,pageHeight-footerHeight+20);
    doc.text(`Page ${i} of ${pageCount}`,pageWidth-80,pageHeight-footerHeight+20);
    // Watermark
    doc.setFontSize(60);
    doc.setTextColor(200,200,200);
    doc.text('Varshith Interior Solutions', pageWidth/2, pageHeight/2, {align:'center', angle:45});
  }

  doc.save(`Invoice_${invoiceNumber}.pdf`);

  // Save invoice to localStorage
  savedInvoices[invoiceNumber]={
    clientName:document.getElementById('clientName').value,
    invoiceDate:document.getElementById('invoiceDate').value,
    clientGST:clientGSTEl.value,
    ourGST:ourGSTEl.value,
    logo:logoDataURL,
    items:rows,
    designs:designs.map(d=>({name:d.name, dataURL:d.dataURL})),
    summary:{total:totalCostEl.textContent, gst:gstAmountEl.textContent, final:finalCostEl.textContent}
  };
  localStorage.setItem('invoices',JSON.stringify(savedInvoices));
});

/* ===== Import JSON ===== */
document.getElementById('importJsonBtn').addEventListener('click',()=>{
  document.getElementById('importJsonFile').click();
});

document.getElementById('importJsonFile').addEventListener('change',async(e)=>{
  const file=e.target.files[0]; if(!file) return;
  const text=await file.text();
  try{
    const data=JSON.parse(text);
    if(!data.invoiceNumber) throw new Error('Missing invoiceNumber');
    if(!confirm('Overwrite current invoice with imported data?')) return;
    // Clear current
    clearRowsBtn.click();
    document.getElementById('clientName').value=data.clientName;
    document.getElementById('invoiceNumber').value=data.invoiceNumber;
    document.getElementById('invoiceDate').value=data.invoiceDate;
    clientGSTEl.value=data.clientGST;
    ourGSTEl.value=data.ourGST;
    logoDataURL=data.logo;
    if(logoDataURL) logoImg.src=logoDataURL;
    data.items.forEach(r=>createRow(...r));
    designs=data.designs.map(d=>{
      const id=uid('design_');
      const div=document.createElement('div');
      div.className='design-item';
      div.dataset.id=id;
      div.innerHTML=`
        <img class="design-thumb" src="${d.dataURL}">
        <div class="design-info">
          <input type="text" class="design-name" value="${escapeHtml(d.name)}">
        </div>
      `;
      designListEl.appendChild(div);
      return {id,name:d.name,dataURL:d.dataURL};
    });
    updateSummary();
  }catch(err){
    alert('Invalid JSON file');
  }
});
