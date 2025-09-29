/* ========================== SCRIPT ========================== */
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

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function uid(prefix='id'){ return prefix + Math.random().toString(36).slice(2,9); }

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

function recalcTotals(){
  let total = 0;
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    total += parseFloat(tr.querySelector('.amount').value) || 0;
  });
  const gstPerc = parseFloat(gstPercentEl.value) || 0;
  const gst = total*gstPerc/100;
  totalCostEl.textContent = total.toFixed(2);
  gstAmountEl.textContent = gst.toFixed(2);
  finalCostEl.textContent = (total+gst).toFixed(2);
}

clearRowsBtn.addEventListener('click', ()=>{
  invoiceTbody.innerHTML='';
  document.getElementById('clientName').value='';
  document.getElementById('clientGST').value='';
  document.getElementById('ourGST').value='';
  document.getElementById('invoiceNumber').value='';
  document.getElementById('invoiceDate').value='';
  totalCostEl.textContent='0.00';
  gstAmountEl.textContent='0.00';
  finalCostEl.textContent='0.00';
  designs=[];
  designListEl.innerHTML='';
  logoImg.src='';
  logoDataURL=null;
});

/* Logo Upload */
logoUpload.addEventListener('change',(e)=>{
  const f=e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = function(ev){ logoImg.src=ev.target.result; logoDataURL=ev.target.result; };
  reader.readAsDataURL(f);
});

/* 2D → 3D Designer */
upload2D.addEventListener('change', e=>{
  const files = Array.from(e.target.files);
  files.forEach(f=>{
    const reader = new FileReader();
    reader.onload = function(ev){
      const id=uid('design');
      const div = document.createElement('div');
      div.className='design-item';
      div.innerHTML=`
        <img class="design-thumb" src="${ev.target.result}">
        <div class="design-info">
          <input type="text" class="design-name" value="${f.name}">
        </div>
        <div class="design-controls">
          <button class="gen3D">Generate 3D</button>
        </div>
      `;
      designListEl.appendChild(div);
      const designObj={id,name:f.name,file:ev.target.result,snapshot:null};
      designs.push(designObj);

      div.querySelector('.gen3D').addEventListener('click', ()=>{
        // Simple placeholder 3D snapshot logic
        designObj.snapshot=ev.target.result; // In real app, generate canvas image
        alert('3D snapshot captured for '+designObj.name);
      });

      div.querySelector('.design-name').addEventListener('input', (ev2)=>{
        designObj.name=ev2.target.value;
      });
    };
    reader.readAsDataURL(f);
  });
});

/* Save / Recover Invoice */
function saveInvoiceData(){
  const invoiceNumber=document.getElementById('invoiceNumber').value.trim();
  if(!invoiceNumber){ alert('Enter invoice number'); return false; }

  let invoices=JSON.parse(localStorage.getItem('savedInvoices')||'{}');
  if(invoices[invoiceNumber]){ 
    if(!confirm('Invoice exists, overwrite?')) return false; 
  }

  const items=[];
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    items.push({
      item: tr.querySelector('.item').value,
      material: tr.querySelector('.material').value,
      qty: parseFloat(tr.querySelector('.qty').value)||0,
      unitPrice: parseFloat(tr.querySelector('.unitPrice').value)||0,
      amount: parseFloat(tr.querySelector('.amount').value)||0
    });
  });

  invoices[invoiceNumber]={
    invoiceNumber,
    invoiceDate: document.getElementById('invoiceDate').value,
    clientName: document.getElementById('clientName').value,
    clientGST: document.getElementById('clientGST').value,
    ourGST: document.getElementById('ourGST').value,
    items,
    totalCost: parseFloat(totalCostEl.textContent),
    gstAmount: parseFloat(gstAmountEl.textContent),
    finalCost: parseFloat(finalCostEl.textContent),
    logoDataURL,
    designs
  };
  localStorage.setItem('savedInvoices',JSON.stringify(invoices));
  return invoices[invoiceNumber];
}

/* Export/Import JSON */
exportJsonBtn.addEventListener('click', ()=>{
  const data=saveInvoiceData();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`Invoice_${data.invoiceNumber}.json`;
  a.click();
});

importJsonBtn.addEventListener('click', ()=>{ importJsonFile.click(); });
importJsonFile.addEventListener('change', e=>{
  const f=e.target.files[0];
  const reader=new FileReader();
  reader.onload = ev=>{
    const data=JSON.parse(ev.target.result);
    document.getElementById('invoiceNumber').value=data.invoiceNumber;
    document.getElementById('invoiceDate').value=data.invoiceDate;
    document.getElementById('clientName').value=data.clientName;
    document.getElementById('clientGST').value=data.clientGST;
    document.getElementById('ourGST').value=data.ourGST;
    invoiceTbody.innerHTML='';
    data.items.forEach(it=>createRow(it.item,it.material,it.qty,it.unitPrice));
    designs=data.designs||[];
    designListEl.innerHTML='';
    designs.forEach(d=>{
      const div=document.createElement('div');
      div.className='design-item';
      div.innerHTML=`<img class="design-thumb" src="${d.file}"><div class="design-info"><input type="text" class="design-name" value="${d.name}"></div><div class="design-controls"><button class="gen3D">Generate 3D</button></div>`;
      designListEl.appendChild(div);
      div.querySelector('.gen3D').addEventListener('click', ()=>{
        d.snapshot=d.file;
        alert('3D snapshot captured for '+d.name);
      });
      div.querySelector('.design-name').addEventListener('input',(ev)=>{ d.name=ev.target.value; });
    });
    logoImg.src=data.logoDataURL||'';
    logoDataURL=data.logoDataURL||null;
    recalcTotals();
  };
  reader.readAsText(f);
});

/* PDF Generation */
generatePDFBtn.addEventListener('click', async () => {
  const data = saveInvoiceData();
  if(!data) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'pt',format:'a4'});
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const headerHeight = 60;
  const footerHeight = 50;
  let currentPage = 1;

  function addHeaderFooter(pageNum){
    // Header
    doc.setFillColor(46,125,50); doc.rect(0,0,pageWidth,headerHeight,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(14);
    if(data.logoDataURL) doc.addImage(data.logoDataURL,'JPEG',10,5,50,50);
    doc.text(`Varshith Interior Solutions`,70,20);
    doc.setFontSize(10);
    doc.text(`NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106`,70,35);
    doc.text(`Phone: +91 9916511599, +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com`,70,50);
    // Footer
    doc.setFillColor(46,125,50); doc.rect(0,pageHeight-footerHeight,pageWidth,footerHeight,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(10);
    doc.text(`Address: NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106`,40,pageHeight-32);
    doc.text(`Phone: +91 9916511599, +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com | GST: ${data.ourGST}`,40,pageHeight-18);
    doc.text(`Page ${pageNum}`,pageWidth-60,pageHeight-18);
    // Watermark
    doc.setTextColor(200,200,200); doc.setFontSize(50);
    doc.text('Varshith Interior Solutions',pageWidth/2,pageHeight/2,{angle:-45,align:'center'});
  }

  addHeaderFooter(currentPage);

  // Invoice info
  let y = headerHeight + 20;
  doc.setTextColor(0,0,0); doc.setFontSize(12);
  doc.text(`Invoice Number: ${data.invoiceNumber}`,40,y); y+=15;
  doc.text(`Invoice Date: ${data.invoiceDate}`,40,y); y+=15;
  doc.text(`Client Name: ${data.clientName}`,40,y); y+=15;
  doc.text(`Client GST: ${data.clientGST}`,40,y); y+=15;
  doc.text(`Our GST: ${data.ourGST}`,40,y); y+=20;

  const tableBody = data.items.map(it=>[it.item,it.material,it.qty,it.unitPrice,it.amount]);
  doc.autoTable({
    startY:y,
    head:[['Item','Material','Qty','Unit Price','Amount']],
    body:tableBody,
    theme:'grid',
    headStyles:{fillColor:[46,125,50],textColor:255},
    didDrawPage: function(data){ currentPage++; addHeaderFooter(currentPage); },
    margin:{top:headerHeight+20,bottom:footerHeight+10}
  });
  y = doc.lastAutoTable.finalY + 10;

  // Totals and payment note
  function addTotals(){
    if(y>pageHeight-footerHeight-80){ doc.addPage(); y=headerHeight+20; currentPage++; addHeaderFooter(currentPage);}
    doc.text(`Total Cost: ${data.totalCost.toFixed(2)}`,40,y); y+=15;
    doc.text(`GST Amount: ${data.gstAmount.toFixed(2)}`,40,y); y+=15;
    doc.text(`Final Cost: ${data.finalCost.toFixed(2)}`,40,y); y+=15;
    doc.text("Payment note: 50 PCT of the quoted amount has to be paid as advance, 30 PCT after completing 50 % of work and remaining 20 PCT after the completion of work.",40,y); y+=25;
  }
  addTotals();

  // Designs
  for(const d of data.designs){
    if(y>pageHeight-footerHeight-170){ doc.addPage(); y=headerHeight+20; currentPage++; addHeaderFooter(currentPage);}
    doc.text(`Design: ${d.name}`,40,y); y+=15;
    if(d.snapshot) { doc.addImage(d.snapshot,getImageTypeFromDataURL(d.snapshot),40,y,200,150); y+=160; }
  }

  doc.save(`Invoice_${data.invoiceNumber}.pdf`);
});

function getImageTypeFromDataURL(dataURL){
  if(dataURL.startsWith('data:image/jpeg')) return 'JPEG';
  if(dataURL.startsWith('data:image/png')) return 'PNG';
  return 'JPEG';
}
