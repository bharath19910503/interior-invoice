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

let logoDataURL=null;
let designs=[];

function escapeHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function uid(prefix='id'){return prefix+Math.random().toString(36).slice(2,9);}
function resizeImageFileToDataURL(file,maxW=1200,maxH=1200,mime='image/jpeg',quality=0.8){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(new Error('read error'));
    r.onload=()=> {
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
        try{ resolve(canvas.toDataURL(mime,quality)); }catch(e){ reject(e);}
      };
      img.onerror=()=>reject(new Error('invalid image'));
      img.src=r.result;
    };
    r.readAsDataURL(file);
  });
}

// ---------------- Invoice Table ----------------
function createRow(item='',material='',qty=1,unitPrice=0){
  const tr=document.createElement('tr');
  tr.innerHTML=`<td><input class="item" type="text" value="${escapeHtml(item)}"></td>
  <td><input class="material" type="text" value="${escapeHtml(material)}"></td>
  <td><input class="qty" type="number" min="0" step="1" value="${qty}"></td>
  <td><input class="unitPrice" type="number" min="0" step="0.01" value="${unitPrice}"></td>
  <td><input class="amount" type="text" readonly value="${(qty*unitPrice).toFixed(2)}"></td>
  <td><button class="deleteBtn">Delete</button></td>`;
  invoiceTbody.appendChild(tr);
  const qtyEl=tr.querySelector('.qty');
  const upEl=tr.querySelector('.unitPrice');
  const amountEl=tr.querySelector('.amount');
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
addRowBtn.addEventListener('click',()=>{ createRow(); recalcTotals(); });
clearRowsBtn.addEventListener('click',()=>{ invoiceTbody.innerHTML=''; recalcTotals(); });

function recalcTotals(){
  let total=0;
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    total+=parseFloat(tr.querySelector('.amount').value)||0;
  });
  const gstPercent=parseFloat(gstPercentEl.value)||0;
  const gstAmount=total*gstPercent/100;
  const final=total+gstAmount;
  totalCostEl.textContent=total.toFixed(2);
  gstAmountEl.textContent=gstAmount.toFixed(2);
  finalCostEl.textContent=final.toFixed(2);
}
gstPercentEl.addEventListener('input',recalcTotals);
invoiceTbody.innerHTML=''; recalcTotals();

// ---------------- Logo Upload ----------------
logoUpload.addEventListener('change',async ev=>{
  const f=ev.target.files[0]; if(!f) return;
  try{
    const mime=f.type&&f.type.includes('png')?'image/png':'image/jpeg';
    logoDataURL=await resizeImageFileToDataURL(f,600,600,mime,0.9);
    logoImg.src=logoDataURL;
  }catch(e){
    const r=new FileReader();
    r.onload=e=>{ logoDataURL=e.target.result; logoImg.src=logoDataURL; };
    r.readAsDataURL(f);
  }
});

// ---------------- 2D → 3D Designer ----------------
upload2D.addEventListener('change',async ev=>{
  const files=Array.from(ev.target.files||[]);
  for(const f of files){
    const id=uid('design_');
    const fileName=f.name;
    let dataURL=null;
    try{ dataURL=await resizeImageFileToDataURL(f,1600,1600,'image/jpeg',0.85); }catch(e){
      const r=new FileReader();
      dataURL=await new Promise((res,rej)=>{ r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsDataURL(f); });
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
    div.innerHTML=`<img class="design-thumb" src="${escapeHtml(d.dataURL)}" alt="${escapeHtml(d.name)}"/>
    <div class="design-info">
      <input class="design-name" value="${escapeHtml(d.name)}"/>
      <div class="design-controls">
        <button class="gen3dBtn">Generate 3D</button>
        <button class="removeBtn">Remove</button>
      </div>
    </div>`;
    const nameInput=div.querySelector('.design-name');
    nameInput.addEventListener('input',e=>{ d.name=e.target.value; });
    div.querySelector('.gen3dBtn').addEventListener('click',()=> generate3DForDesign(d.id));
    div.querySelector('.removeBtn').addEventListener('click',()=>{
      designs=designs.filter(x=>x.id!==d.id); renderDesignList();
    });
    designListEl.appendChild(div);
  });
}

// ---------------- 3D Preview ----------------
let globalRenderer=null,globalScene=null,globalCamera=null,globalControls=null,globalMesh=null;
async function generate3DForDesign(designId){
  const entry=designs.find(d=>d.id===designId); if(!entry){ alert('Design not found'); return; }
  progressContainer.style.display='block'; progressBar.style.width='0%';
  let p=0;
  const id=setInterval(()=>{
    p+=Math.random()*18; if(p>100) p=100;
    progressBar.style.width=`${p}%`;
    if(p===100){ clearInterval(id); setTimeout(()=>{ progressContainer.style.display='none'; render3DPlaneAndCapture(entry); },200);}
  },150);
}

function render3DPlaneAndCapture(entry){
  if(globalRenderer){ try{ globalRenderer.forceContextLoss(); globalRenderer.domElement.remove(); }catch(e){} globalRenderer=null; globalScene=null; globalCamera=null; globalControls=null; globalMesh=null; }
  globalScene=new THREE.Scene(); globalScene.background=new THREE.Color(0xf3f3f3);
  const w=preview3D.clientWidth||600; const h=preview3D.clientHeight||380;
  globalCamera=new THREE.PerspectiveCamera(45,w/h,0.1,1000); globalCamera.position.set(0,0,5);
  globalRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); globalRenderer.setSize(w,h);
  preview3D.innerHTML=''; preview3D.appendChild(globalRenderer.domElement);
  const ambient=new THREE.AmbientLight(0xffffff,0.9); globalScene.add(ambient);
  const dir=new THREE.DirectionalLight(0xffffff,0.4); dir.position.set(0,1,1); globalScene.add(dir);
  const geometry=new THREE.PlaneGeometry(4,3);
  const loader=new THREE.TextureLoader();
  const texture=loader.load(entry.dataURL,()=>{ globalRenderer.render(globalScene,globalCamera); });
  const material=new THREE.MeshPhongMaterial({map:texture,side:THREE.DoubleSide});
  globalMesh=new THREE.Mesh(geometry,material); globalScene.add(globalMesh);
  globalControls=new THREE.OrbitControls(globalCamera,globalRenderer.domElement);
  globalControls.enableDamping=true; globalControls.dampingFactor=0.08;
  function animate(){ requestAnimationFrame(animate); globalControls.update(); globalRenderer.render(globalScene,globalCamera); }
  animate();
  setTimeout(()=>{ try{ entry.snapshot=globalRenderer.domElement.toDataURL('image/png'); }catch(e){ entry.snapshot=null;} renderDesignList(); alert(`3D Preview generated for "${entry.name}"`); },800);
}

// ---------------- PDF Generation ----------------
function getImageTypeFromDataURL(dataURL){
  if(!dataURL) return 'PNG';
  const h=dataURL.substring(0,30).toLowerCase();
  if(h.includes('data:image/jpeg')||h.includes('data:image/jpg')) return 'JPEG';
  if(h.includes('data:image/png')) return 'PNG';
  return 'PNG';
}

generatePDFBtn.addEventListener('click',()=>{
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF('p','pt','a4');
  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();
  const margin=40;

  const clientName=document.getElementById('clientName')?.value||'';
  const invoiceNumber=document.getElementById('invoiceNumber')?.value||'';
  const invoiceDate=document.getElementById('invoiceDate')?.value||new Date().toLocaleDateString();
  const gstPercent=parseFloat(gstPercentEl.value)||0;

  const body=[];
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    const item=tr.querySelector('.item').value||'';
    const material=tr.querySelector('.material').value||'';
    const qty=tr.querySelector('.qty').value||'0';
    const amount=tr.querySelector('.amount').value||'0.00';
    body.push([item,material,qty,amount]);
  });

  const total=parseFloat(totalCostEl.textContent)||0;
  const gstAmount=parseFloat(gstAmountEl.textContent)||0;
  const final=parseFloat(finalCostEl.textContent)||0;

  function drawHeader(){ 
    if(logoDataURL){ try{ doc.addImage(logoDataURL,getImageTypeFromDataURL(logoDataURL),margin,18,72,48); }catch(e){} }
    doc.setFontSize(18); doc.setTextColor(20,20,20); doc.text("Varshith Interior Solutions",pageWidth/2,40,{align:'center'});
    doc.setFontSize(10);
    doc.text("NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106",pageWidth/2,56,{align:'center'});
    doc.text("Phone: +91 9916511599 & +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com",pageWidth/2,70,{align:'center'});
  }

  function drawFooter(){ 
    const pageCount=doc.internal.getNumberOfPages();
    doc.setFontSize(10); doc.setTextColor(100);
    const footerY=pageHeight-30;
    doc.text("Address: NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106",margin,footerY);
    doc.text("Phone: +91 9916511599 & +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com",margin,footerY+12);
    doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${pageCount}`,pageWidth-margin-60,footerY+6);
  }

  drawHeader();
  const infoY=90;
  if(clientName) doc.text(`Client: ${clientName}`,margin,infoY);
  const rightX=pageWidth-margin-200;
  if(invoiceNumber) doc.text(`Invoice No: ${invoiceNumber}`,rightX,infoY);
  if(invoiceDate) doc.text(`Date: ${invoiceDate}`,rightX,infoY+12);

  const topStartY=110;
  try{
    doc.autoTable({head:[['Item','Material Used','Qty','Amount']],body,startY:topStartY,theme:'grid',
      styles:{fontSize:10,cellPadding:6,overflow:'linebreak'},
      headStyles:{fillColor:[46,125,50],textColor:255,halign:'center'},
      columnStyles:{0:{cellWidth:150},1:{cellWidth:240},2:{cellWidth:50,halign:'center'},3:{cellWidth:80,halign:'right'}},
      didDrawPage:data=>{drawHeader();drawFooter();},
      margin:{top:topStartY-30,bottom:110}
    });
  }catch(err){ console.error('autoTable failed',err); }

  let finalY=(doc.lastAutoTable && doc.lastAutoTable.finalY)? doc.lastAutoTable.finalY+12: topStartY+20;
  if(finalY+120>pageHeight-40){ doc.addPage(); drawHeader(); drawFooter(); finalY=80; }

  const totalsX=pageWidth-margin-220;
  doc.setFontSize(11); doc.setTextColor(30); doc.text("Summary",totalsX,finalY);
  doc.setFontSize(10);
  doc.text(`Total Cost:`,totalsX,finalY+18); doc.text(`${(total).toFixed(2)}`,totalsX+140,finalY+18,{align:'right'});
  doc.text(`GST (${gstPercent}%):`,totalsX,finalY+36); doc.text(`${(gstAmount).toFixed(2)}`,totalsX+140,finalY+36,{align:'right'});
  doc.setFont(undefined,'bold'); doc.text(`Final Cost:`,totalsX,finalY+56); doc.text(`${(final).toFixed(2)}`,totalsX+140,finalY+56,{align:'right'}); doc.setFont(undefined,'normal');

  // Embed all designs at the end
  let currY=finalY+80;
  for(const d of designs){
    const embed=d.snapshot||d.dataURL;
    if(!embed) continue;
    if(currY+30>pageHeight-40){ doc.addPage(); drawHeader(); drawFooter(); currY=80; }
    doc.setFontSize(10); doc.setTextColor(20,20,20);
    doc.text(`Design: ${d.name}`,margin,currY); currY+=14;
    const imageW=260,imageH=180;
    if(currY+imageH>pageHeight-40){ doc.addPage(); drawHeader(); drawFooter(); currY=80; }
    try{ doc.addImage(embed,getImageTypeFromDataURL(embed),margin,currY,imageW,imageH); }catch(e){ console.warn('Embed failed',e);}
    currY+=imageH+12;
  }

  doc.save(`Invoice_${invoiceNumber||Date.now()}.pdf`);
});

// ---------------- JSON Import/Export ----------------
if(exportJsonBtn){
  exportJsonBtn.addEventListener('click',()=>{
    const rows=[];
    invoiceTbody.querySelectorAll('tr').forEach(r=>{
      rows.push({item:r.querySelector('.item').value,material:r.querySelector('.material').value,qty:r.querySelector('.qty').value,unitPrice:r.querySelector('.unitPrice')?r.querySelector('.unitPrice').value:'',amount:r.querySelector('.amount').value||''});
    });
    const payload={clientName:document.getElementById('clientName')?.value||'',invoiceNumber:document.getElementById('invoiceNumber')?.value||'',invoiceDate:document.getElementById('invoiceDate')?.value||'',gst:gstPercentEl.value,rows,logoDataURL,designs};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`invoice_${payload.invoiceNumber||Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove();
  });
}
if(importJsonBtn){ importJsonBtn.addEventListener('click',()=> importJsonFile.click()); }
if(importJsonFile){
  importJsonFile.addEventListener('change',async ev=>{
    const f=ev.target.files[0]; if(!f) return;
    const text=await f.text(); try{
      const payload=JSON.parse(text);
      document.getElementById('clientName').value=payload.clientName||'';
      document.getElementById('invoiceNumber').value=payload.invoiceNumber||'';
      document.getElementById('invoiceDate').value=payload.invoiceDate||'';
      gstPercentEl.value=payload.gst||18;
      invoiceTbody.innerHTML=''; (payload.rows||[]).forEach(r=>createRow(r.item,r.material,r.qty,r.unitPrice)); recalcTotals();
      if(payload.logoDataURL){ logoDataURL=payload.logoDataURL; logoImg.src=logoDataURL; }
      if(payload.designs){ designs=payload.designs; renderDesignList(); }
    }catch(e){ alert('Invalid JSON'); }
  });
}
