/* ==========================
  Fully Working Invoice + 3D Designer Script
==========================*/

/* ======= DOM Elements ======= */
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
let designs = []; // {id,name,fileName,dataURL,snapshot}

/* ======= Utilities ======= */
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function uid(prefix='id'){ return prefix + Math.random().toString(36).slice(2,9); }
function getImageTypeFromDataURL(dataURL){
  if(!dataURL) return 'PNG';
  const h = dataURL.substring(0,30).toLowerCase();
  if(h.includes('jpeg')||h.includes('jpg')) return 'JPEG';
  if(h.includes('png')) return 'PNG';
  return 'PNG';
}
function resizeImageFileToDataURL(file,maxW=1200,maxH=1200,mime='image/jpeg',quality=0.8){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(new Error('read error'));
    r.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        let w=img.width,h=img.height;
        const ratio=Math.min(maxW/w,maxH/h,1);
        w=Math.round(w*ratio); h=Math.round(h*ratio);
        const canvas=document.createElement('canvas');
        canvas.width=w; canvas.height=h;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);
        try{ resolve(canvas.toDataURL(mime,quality)); }catch(e){ reject(e); }
      };
      img.onerror=()=>reject(new Error('invalid image'));
      img.src=r.result;
    };
    r.readAsDataURL(file);
  });
}

/* ======= Invoice Table ======= */
function createRow(item='', material='', qty=1, unitPrice=0){
  const tr=document.createElement('tr');
  tr.innerHTML=`
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
    const q=parseFloat(qtyEl.value)||0;
    const p=parseFloat(upEl.value)||0;
    amountEl.value=(q*p).toFixed(2);
    recalcTotals();
  }

  qtyEl.addEventListener('input',updateLine);
  upEl.addEventListener('input',updateLine);
  tr.querySelector('.deleteBtn').addEventListener('click',()=>{ tr.remove(); recalcTotals(); });
}

function recalcTotals(){
  let total=0;
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    total += parseFloat(tr.querySelector('.amount').value)||0;
  });
  const gstPercent=parseFloat(gstPercentEl.value)||0;
  const gstAmount=total*gstPercent/100;
  const final=total+gstAmount;
  totalCostEl.textContent=total.toFixed(2);
  gstAmountEl.textContent=gstAmount.toFixed(2);
  finalCostEl.textContent=final.toFixed(2);
}

addRowBtn.addEventListener('click',()=>{ createRow(); recalcTotals(); });
clearRowsBtn.addEventListener('click',()=>{ invoiceTbody.innerHTML=''; recalcTotals(); });
gstPercentEl.addEventListener('input',recalcTotals);
invoiceTbody.innerHTML=''; recalcTotals();

/* ======= Logo Upload ======= */
logoUpload.addEventListener('change',async ev=>{
  const f=ev.target.files[0]; if(!f) return;
  try{
    const mime=f.type.includes('png')?'image/png':'image/jpeg';
    logoDataURL=await resizeImageFileToDataURL(f,600,600,mime,0.9);
    logoImg.src=logoDataURL;
  }catch(e){
    const r=new FileReader();
    r.onload=e=>{ logoDataURL=e.target.result; logoImg.src=logoDataURL; };
    r.readAsDataURL(f);
  }
});

/* ======= 2D → 3D Design Upload ======= */
upload2D.addEventListener('change',async ev=>{
  const files=Array.from(ev.target.files||[]);
  for(const f of files){
    const id=uid('design_');
    const fileName=f.name;
    let dataURL=null;
    try{ dataURL=await resizeImageFileToDataURL(f,1600,1600,'image/jpeg',0.85); }
    catch(e){ dataURL=null; }
    const entry={id,name:fileName,fileName,dataURL,snapshot:null};
    designs.push(entry);
  }
  renderDesignList();
  upload2D.value='';
});

/* Render Design List */
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
    const nameInput=div.querySelector('.design-name');
    nameInput.addEventListener('input',e=>{ d.name=e.target.value; });

    div.querySelector('.gen3dBtn').addEventListener('click',()=> generate3DForDesign(d.id));
    div.querySelector('.removeBtn').addEventListener('click',()=>{ designs=designs.filter(x=>x.id!==d.id); renderDesignList(); });

    designListEl.appendChild(div);
  });
}

/* ======= 3D Generation ======= */
let globalRenderer=null, globalScene=null, globalCamera=null, globalControls=null, globalMesh=null;
async function generate3DForDesign(designId){
  const entry=designs.find(d=>d.id===designId);
  if(!entry){ alert('Design not found'); return; }

  progressContainer.style.display='block'; progressBar.style.width='0%';
  let p=0;
  const id=setInterval(()=>{
    p+=Math.random()*18; if(p>100)p=100;
    progressBar.style.width=`${p}%`;
    if(p===100){ clearInterval(id); setTimeout(()=>{ progressContainer.style.display='none'; render3DPlaneAndCapture(entry); },200); }
  },150);
}

function render3DPlaneAndCapture(entry){
  if(globalRenderer){
    try{ globalRenderer.forceContextLoss(); globalRenderer.domElement.remove(); }catch(e){}
    globalRenderer=null; globalScene=null; globalCamera=null; globalControls=null; globalMesh=null;
  }

  globalScene=new THREE.Scene(); globalScene.background=new THREE.Color(0xf3f3f3);
  const w=preview3D.clientWidth||600,h=preview3D.clientHeight||380;
  globalCamera=new THREE.PerspectiveCamera(45,w/h,0.1,1000);
  globalCamera.position.set(0,0,5);
  globalRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  globalRenderer.setSize(w,h);
  preview3D.innerHTML=''; preview3D.appendChild(globalRenderer.domElement);

  const ambient=new THREE.AmbientLight(0xffffff,0.9); globalScene.add(ambient);
  const dir=new THREE.DirectionalLight(0xffffff,0.4); dir.position.set(0,1,1); globalScene.add(dir);

  const geometry=new THREE.PlaneGeometry(4,3);
  const texture=new THREE.TextureLoader().load(entry.dataURL,()=>{
    const material=new THREE.MeshBasicMaterial({map:texture});
    globalMesh=new THREE.Mesh(geometry,material); globalScene.add(globalMesh);
    globalControls=new THREE.OrbitControls(globalCamera,globalRenderer.domElement);
    globalControls.update();
    globalRenderer.render(globalScene,globalCamera);
    setTimeout(()=>{
      try{ entry.snapshot=globalRenderer.domElement.toDataURL('image/png'); }
      catch(e){ entry.snapshot=entry.dataURL; }
      alert(`3D generated for "${entry.name}"`);
    },200);
  });

  function animate(){
    requestAnimationFrame(animate);
    globalControls?.update();
    globalRenderer?.render(globalScene,globalCamera);
  }
  animate();
}

/* ======= PDF Generation ======= */
generatePDFBtn.addEventListener('click',()=>{
  const { jsPDF } = window.jspdf;
  const doc=new jsPDF('p','pt','a4');
  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();
  const margin=40;

  const clientName=document.getElementById('clientName')?.value||'';
  const invoiceNumber=document.getElementById('invoiceNumber')?.value||'';
  const invoiceDate=document.getElementById('invoiceDate')?.value||new Date().toLocaleDateString();

  // Header
  doc.setFillColor(46,125,50); doc.rect(0,0,pageWidth,60,'F');
  doc.setFontSize(18); doc.setTextColor(255); doc.text("Varshith Interior Solutions",margin,35);
  if(logoDataURL) doc.addImage(logoDataURL,'PNG',pageWidth-100,5,72,50);
  doc.setFontSize(10); doc.text("Phone: +91 9916511599 | +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com",margin,50);

  // Client Info
  doc.setFontSize(12); doc.setTextColor(0);
  doc.text(`Client: ${clientName}`,margin,80);
  doc.text(`Invoice No: ${invoiceNumber}`,margin,100);
  doc.text(`Date: ${invoiceDate}`,margin,120);

  // Table
  const body=[];
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    body.push([tr.querySelector('.item').value,tr.querySelector('.material').value,tr.querySelector('.qty').value,tr.querySelector('.unitPrice').value,tr.querySelector('.amount').value]);
  });
  doc.autoTable({head:[['Item','Material','Qty','Unit Price','Amount']],body,startY:140,theme:'grid',headStyles:{fillColor:[46,125,50],textColor:255},styles:{fontSize:10}});

  // Totals
  const totalY=(doc.lastAutoTable?.finalY)||200;
  doc.setFontSize(11); doc.text(`Total Cost: ${totalCostEl.textContent}`,margin,totalY);
  doc.text(`GST (${gstPercentEl.value}%): ${gstAmountEl.textContent}`,margin,totalY+20);
  doc.setFont(undefined,'bold'); doc.text(`Final Cost: ${finalCostEl.textContent}`,margin,totalY+40);
  doc.setFont(undefined,'normal');

  // Payment Note
  doc.setFontSize(10); doc.setTextColor(80);
  doc.text("Payment note: 50 PCT of the quoted amount has to be paid as advance, 30 PCT after completing 50% of work and remaining 20 PCT after completion.",margin,totalY+60,{maxWidth:pageWidth-2*margin});

  // Designs
  let yPos=totalY+90;
  designs.forEach(d=>{
    if(d.snapshot||d.dataURL){
      const imgData=d.snapshot||d.dataURL;
      const imgW=180,imgH=120;
      if(yPos+imgH>pageHeight-80){ doc.addPage(); yPos=40; }
      doc.setFontSize(10); doc.setTextColor(0);
      doc.text(`Design: ${d.name}`,margin,yPos);
      doc.addImage(imgData,'PNG',margin,yPos+5,imgW,imgH);
      yPos+=imgH+30;
    }
  });

  // Watermark
  doc.setFontSize(50); doc.setTextColor(220,220,220);
  doc.text('Varshith Interior Solutions',pageWidth/2,pageHeight/2,{angle:45,align:'center',baseline:'middle'});

  // Footer with Page Numbers
  const pageCount=doc.internal.getNumberOfPages();
  for(let i=1;i<=pageCount;i++){
    doc.setPage(i);
    doc.setFillColor(46,125,50); doc.rect(0,pageHeight-40,pageWidth,40,'F');
    doc.setFontSize(10); doc.setTextColor(255,255,255);
    doc.text(`Page ${i} of ${pageCount}`,pageWidth-100,pageHeight-15);
    doc.text("Varshith Interior Solutions",margin,pageHeight-15);
  }

  doc.save(`Invoice_${invoiceNumber||Date.now()}.pdf`);
});

/* ======= Export / Import JSON ======= */
exportJsonBtn.addEventListener('click',()=>{
  const data={invoiceNumber:document.getElementById('invoiceNumber').value||'',clientName:document.getElementById('clientName').value||'',invoiceDate:document.getElementById('invoiceDate').value||'',items:[],gstPercent:gstPercentEl.value||0,designs:[],logo:logoDataURL};
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    data.items.push({item:tr.querySelector('.item').value,material:tr.querySelector('.material').value,qty:tr.querySelector('.qty').value,unitPrice:tr.querySelector('.unitPrice').value,amount:tr.querySelector('.amount').value});
  });
  designs.forEach(d=>{ data.designs.push({id:d.id,name:d.name,dataURL:d.dataURL,snapshot:d.snapshot}); });
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`Invoice_${data.invoiceNumber||Date.now()}.json`; a.click();
});

importJsonBtn.addEventListener('click',()=>importJsonFile.click());
importJsonFile.addEventListener('change',async ev=>{
  const f=ev.target.files[0]; if(!f) return;
  const text=await f.text();
  try{
    const data=JSON.parse(text);
    document.getElementById('clientName').value=data.clientName||'';
    document.getElementById('invoiceNumber').value=data.invoiceNumber||'';
    document.getElementById('invoiceDate').value=data.invoiceDate||'';
    gstPercentEl.value=data.gstPercent||18;
    invoiceTbody.innerHTML='';
    designs=[];
    data.items?.forEach(it=>createRow(it.item,it.material,it.qty,it.unitPrice));
    data.designs?.forEach(d=>designs.push(d));
    logoDataURL=data.logo||null;
    if(logoDataURL) logoImg.src=logoDataURL;
    renderDesignList();
    recalcTotals();
  }catch(e){ alert('Invalid JSON file'); }
});
