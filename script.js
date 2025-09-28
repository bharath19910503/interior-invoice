/* ========== Invoice & 2D→3D Designer ========== */

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

let logoDataURL = null;
let designs = [];

/* --- Utility --- */
function uid(prefix='id'){ return prefix + Math.random().toString(36).substr(2,9); }
function escapeHtml(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* Resize image to dataURL */
function resizeImageFileToDataURL(file,maxW=1200,maxH=1200,mime='image/jpeg',quality=0.8){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{ 
      const img = new Image(); 
      img.onload = ()=>{
        let w=img.width,h=img.height;
        const ratio = Math.min(maxW/w,maxH/h,1);
        w=Math.round(w*ratio); h=Math.round(h*ratio);
        const canvas=document.createElement('canvas');
        canvas.width=w; canvas.height=h;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL(mime,quality));
      };
      img.onerror=()=>reject('Invalid image');
      img.src=reader.result;
    };
    reader.onerror=()=>reject('Read error');
    reader.readAsDataURL(file);
  });
}

/* ===== Invoice Table ===== */
function createRow(item='', material='', qty=1, unitPrice=0){
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input class="item" type="text" value="${escapeHtml(item)}"></td>
    <td><input class="material" type="text" value="${escapeHtml(material)}"></td>
    <td><input class="qty" type="number" min="0" step="1" value="${qty}"></td>
    <td><input class="unitPrice" type="number" min="0" step="0.01" value="${unitPrice}"></td>
    <td><input class="amount" type="text" readonly value="${(qty*unitPrice).toFixed(2)}"></td>
    <td><button class="deleteBtn">Delete</button></td>`;
  invoiceTbody.appendChild(tr);

  const qtyEl = tr.querySelector('.qty');
  const upEl = tr.querySelector('.unitPrice');
  function updateLine(){
    const q=parseFloat(qtyEl.value)||0;
    const p=parseFloat(upEl.value)||0;
    tr.querySelector('.amount').value=(q*p).toFixed(2);
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
    total += parseFloat(tr.querySelector('.amount').value)||0;
  });
  const gstPercent=parseFloat(gstPercentEl.value)||0;
  const gstAmount=total*gstPercent/100;
  totalCostEl.textContent = total.toFixed(2);
  gstAmountEl.textContent = gstAmount.toFixed(2);
  finalCostEl.textContent = (total+gstAmount).toFixed(2);
}
gstPercentEl.addEventListener('input',recalcTotals);
invoiceTbody.innerHTML=''; recalcTotals();

/* ===== Logo Upload ===== */
logoUpload.addEventListener('change', async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{ logoDataURL = await resizeImageFileToDataURL(f,600,600,f.type.includes('png')?'image/png':'image/jpeg',0.9); }catch(e){
    const r=new FileReader(); r.onload=e=>{ logoDataURL=e.target.result; }; r.readAsDataURL(f);
  }
  logoImg.src = logoDataURL;
});

/* ===== 2D Designs ===== */
upload2D.addEventListener('change', async e=>{
  const files = Array.from(e.target.files||[]);
  for(const f of files){
    const id=uid('design_'); const fileName=f.name;
    let dataURL = null;
    try{ dataURL = await resizeImageFileToDataURL(f,1600,1600,'image/jpeg',0.85); }catch{ const r=new FileReader(); dataURL=await new Promise(res=>{ r.onload=e=>res(e.target.result); r.readAsDataURL(f); }); }
    designs.push({id,name:fileName,fileName,dataURL,snapshot:null});
  }
  renderDesignList(); upload2D.value='';
});

function renderDesignList(){
  designListEl.innerHTML='';
  designs.forEach(d=>{
    const div=document.createElement('div'); div.className='design-item';
    div.innerHTML=`<img class="design-thumb" src="${escapeHtml(d.dataURL)}"/>
      <div class="design-info">
        <input class="design-name" value="${escapeHtml(d.name)}"/>
        <div class="design-controls">
          <button class="gen3dBtn">Generate 3D</button>
          <button class="removeBtn">Remove</button>
        </div>
      </div>`;
    const nameInput=div.querySelector('.design-name'); nameInput.addEventListener('input',e=>{ d.name=e.target.value; });
    div.querySelector('.gen3dBtn').addEventListener('click',()=>generate3DForDesign(d.id));
    div.querySelector('.removeBtn').addEventListener('click',()=>{ designs=designs.filter(x=>x.id!==d.id); renderDesignList(); });
    designListEl.appendChild(div);
  });
}

/* ===== 3D Preview & Snapshot ===== */
let globalRenderer=null, globalScene=null, globalCamera=null, globalControls=null, globalMesh=null;

async function generate3DForDesign(designId){
  const entry=designs.find(d=>d.id===designId); if(!entry) return;
  progressContainer.style.display='block'; progressBar.style.width='0%';
  let p=0; const id=setInterval(()=>{ p+=Math.random()*15; if(p>100)p=100; progressBar.style.width=p+'%'; if(p===100){ clearInterval(id); progressContainer.style.display='none'; render3DPlaneAndCapture(entry); } },120);
}

function render3DPlaneAndCapture(entry){
  if(globalRenderer){ try{ globalRenderer.forceContextLoss(); globalRenderer.domElement.remove(); }catch{} globalRenderer=null; globalScene=null; globalCamera=null; globalControls=null; globalMesh=null; }
  globalScene=new THREE.Scene(); globalScene.background=new THREE.Color(0xf3f3f3);
  const w=preview3D.clientWidth||600, h=preview3D.clientHeight||380;
  globalCamera=new THREE.PerspectiveCamera(45,w/h,0.1,1000); globalCamera.position.set(0,0,5);
  globalRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); globalRenderer.setSize(w,h); preview3D.innerHTML=''; preview3D.appendChild(globalRenderer.domElement);
  globalScene.add(new THREE.AmbientLight(0xffffff,0.9)); const dir=new THREE.DirectionalLight(0xffffff,0.4); dir.position.set(0,1,1); globalScene.add(dir);
  const geometry=new THREE.PlaneGeometry(4,3); const texture=new THREE.TextureLoader().load(entry.dataURL);
  const material=new THREE.MeshPhongMaterial({map:texture,side:THREE.DoubleSide});
  globalMesh=new THREE.Mesh(geometry,material); globalScene.add(globalMesh);
  globalControls=new THREE.OrbitControls(globalCamera,globalRenderer.domElement); globalControls.enableDamping=true; globalControls.dampingFactor=0.08;
  function animate(){ requestAnimationFrame(animate); globalControls.update(); globalRenderer.render(globalScene,globalCamera); }
  animate();
  setTimeout(()=>{ try{ entry.snapshot=globalRenderer.domElement.toDataURL('image/png'); }catch{ entry.snapshot=null; } renderDesignList(); },800);
}

/* ===== PDF Generation ===== */
generatePDFBtn.addEventListener('click',()=>{
  const {jsPDF}=window.jspdf; const doc=new jsPDF('p','pt','a4'); const pageWidth=doc.internal.pageSize.getWidth(), margin=40;
  const clientName=document.getElementById('clientName')?.value||'';
  const invoiceNumber=document.getElementById('invoiceNumber')?.value||'';
  const invoiceDate=document.getElementById('invoiceDate')?.value||new Date().toLocaleDateString();
  const gstPercent=parseFloat(gstPercentEl.value)||0;

  // Invoice Table Body
  const body=[]; invoiceTbody.querySelectorAll('tr').forEach(tr=>{ body.push([tr.querySelector('.item').value,tr.querySelector('.material').value,tr.querySelector('.qty').value,tr.querySelector('.amount').value]); });
  const total=parseFloat(totalCostEl.textContent)||0, gstAmount=parseFloat(gstAmountEl.textContent)||0, final=parseFloat(finalCostEl.textContent)||0;

  // Header
  if(logoDataURL) doc.addImage(logoDataURL,'PNG',margin,18,72,48);
  doc.setFontSize(18); doc.text("Varshith Interior Solutions", pageWidth/2, 40, {align:'center'});
  doc.setFontSize(10); doc.text("NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106", pageWidth/2, 56, {align:'center'});
  doc.text("Phone: +91 9916511599 & +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com", pageWidth/2,70,{align:'center
