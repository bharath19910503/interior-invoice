/* ====== DOM Elements ====== */
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
const invoiceNumberEl = document.getElementById('invoiceNumber');

let logoDataURL = null;
let designs = []; // {id, name, fileName, dataURL, snapshot}

/* ===== Utilities ===== */
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getImageTypeFromDataURL(dataURL){
  if(!dataURL) return 'PNG';
  const h = dataURL.substring(0,30).toLowerCase();
  if(h.includes('data:image/jpeg')||h.includes('data:image/jpg')) return 'JPEG';
  if(h.includes('data:image/png')) return 'PNG';
  return 'PNG';
}
function uid(prefix='id'){ return prefix + Math.random().toString(36).slice(2,9); }

/* ===== Image resize helper ===== */
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
        try { resolve(canvas.toDataURL(mime, quality)); } catch(e){ reject(e); }
      };
      img.onerror = ()=>reject(new Error('invalid image'));
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/* ===== Invoice Table Row ===== */
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

/* ===== Totals ===== */
function recalcTotals(){
  let total = 0;
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    total += parseFloat(tr.querySelector('.amount').value) || 0;
  });
  const gstPercent = parseFloat(gstPercentEl.value)||0;
  const gstAmount = total * gstPercent / 100;
  const final = total + gstAmount;
  totalCostEl.textContent = total.toFixed(2);
  gstAmountEl.textContent = gstAmount.toFixed(2);
  finalCostEl.textContent = final.toFixed(2);
}
gstPercentEl.addEventListener('input', recalcTotals);
invoiceTbody.innerHTML = ''; recalcTotals();
addRowBtn.addEventListener('click', ()=>{ createRow(); recalcTotals(); });
clearRowsBtn.addEventListener('click', ()=>{ invoiceTbody.innerHTML=''; recalcTotals(); });

/* ===== Logo Upload ===== */
logoUpload.addEventListener('change', async (ev)=>{
  const f = ev.target.files[0]; if(!f) return;
  try{ logoDataURL = await resizeImageFileToDataURL(f, 600,600,f.type.includes('png')?'image/png':'image/jpeg',0.9); logoImg.src = logoDataURL; } 
  catch(e){ const r=new FileReader(); r.onload=e=>{logoDataURL=e.target.result;logoImg.src=logoDataURL}; r.readAsDataURL(f);}
});

/* ===== Designs Upload & Render ===== */
upload2D.addEventListener('change', async (ev)=>{
  const files = Array.from(ev.target.files || []);
  for(const f of files){
    const id = uid('design_');
    const fileName = f.name;
    let dataURL = null;
    try { dataURL = await resizeImageFileToDataURL(f,1600,1600,'image/jpeg',0.85);} 
    catch(e){ const r=new FileReader(); dataURL=await new Promise((res,rej)=>{r.onload=e=>res(e.target.result); r.onerror=rej;r.readAsDataURL(f);});}
    const entry = {id,name:fileName,fileName,dataURL,snapshot:null};
    designs.push(entry);
    renderDesignList();
  }
  upload2D.value = '';
});

function renderDesignList(){
  designListEl.innerHTML = '';
  designs.forEach((d)=>{
    const div=document.createElement('div'); div.className='design-item';
    div.innerHTML=`
      <img class="design-thumb" src="${escapeHtml(d.dataURL)}" alt="${escapeHtml(d.name)}"/>
      <div class="design-info">
        <input class="design-name" value="${escapeHtml(d.name)}"/>
        <div class="design-controls">
          <button class="gen3dBtn">Generate 3D</button>
          <button class="removeBtn">Remove</button>
        </div>
      </div>
    `;
    const nameInput = div.querySelector('.design-name');
    nameInput.addEventListener('input',(e)=>{d.name=e.target.value;});
    div.querySelector('.gen3dBtn').addEventListener('click',()=>generate3DForDesign(d.id));
    div.querySelector('.removeBtn').addEventListener('click',()=>{designs=designs.filter(x=>x.id!==d.id);renderDesignList();});
    designListEl.appendChild(div);
  });
}

/* ===== 3D Preview ===== */
let globalRenderer=null, globalScene=null, globalCamera=null, globalControls=null, globalMesh=null;
async function generate3DForDesign(designId){
  const entry=designs.find(d=>d.id===designId);
  if(!entry){ alert('Design not found'); return; }
  progressContainer.style.display='block'; progressBar.style.width='0%';
  let p=0;
  const id=setInterval(()=>{
    p+=Math.random()*18; if(p>100)p=100;
    progressBar.style.width=`${p}%`;
    if(p===100){clearInterval(id); setTimeout(()=>{ progressContainer.style.display='none'; render3DPlaneAndCapture(entry); },200);}
  },150);
}

function render3DPlaneAndCapture(entry){
  if(globalRenderer){try{ globalRenderer.forceContextLoss(); globalRenderer.dom
