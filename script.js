let designs = [];

const designList = document.getElementById('design-list');
const addBtn = document.getElementById('add-design');
const generateBtn = document.getElementById('generate-pdf');

function formatINR(num){
  return '₹ ' + num.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function renderDesigns(){
  designList.innerHTML = '';
  designs.forEach((d, index)=>{
    const div = document.createElement('div');
    div.className = 'design-item';
    div.innerHTML = `
      <img src="${d.thumb || '#'}" class="design-thumb">
      <div class="design-info">
        <input type="text" value="${d.name}" placeholder="Designer Name" class="designer-name">
        <input type="number" value="${d.amount}" placeholder="Amount (INR)" class="design-amount" min="0">
        <input type="file" accept="image/*" class="design-thumb-input">
      </div>
      <div class="design-controls">
        <button class="delete-btn">Delete</button>
      </div>
    `;

    div.querySelector('.designer-name').addEventListener('input', e=> d.name = e.target.value);
    div.querySelector('.design-amount').addEventListener('input', e=> d.amount = parseFloat(e.target.value));
    
    div.querySelector('.design-thumb-input').addEventListener('change', (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = evt=>{
        d.thumb = evt.target.result;
        div.querySelector('.design-thumb').src = d.thumb;
      }
      reader.readAsDataURL(file);
    });

    div.querySelector('.delete-btn').addEventListener('click', ()=>{
      designs.splice(index,1);
      renderDesigns();
    });

    designList.appendChild(div);
  });
}

addBtn.addEventListener('click', ()=>{
  designs.push({name:'', amount:0, thumb:'#'});
  renderDesigns();
});

// PDF generation using jsPDF
generateBtn.addEventListener('click', ()=>{
  if(designs.length === 0){ alert("Add at least one design"); return; }
  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(16);
  doc.text("Invoice", 105, y, null, null, "center");
  y += 10;
  designs.forEach(d=>{
    if(d.thumb && d.thumb !== '#'){
      try{ doc.addImage(d.thumb,'JPEG',20,y,40,30);}catch(e){console.error(e);}
      doc.text(`Designer: ${d.name}`,65,y+8);
      doc.text(`Amount: ${formatINR(d.amount)}`,65,y+14);
      doc.text(`Advance (50%): ${formatINR(d.amount*0.5)}`,65,y+20);
      doc.text(`After 50% work (30%): ${formatINR(d.amount*0.3)}`,65,y+26);
      doc.text(`On Completion (20%): ${formatINR(d.amount*0.2)}`,65,y+32);
      y += 40;
    } else {
      doc.text(`Designer: ${d.name}`,20,y);
      doc.text(`Amount: ${formatINR(d.amount)}`,120,y);
      y += 6;
      doc.text(`Advance (50%): ${formatINR(d.amount*0.5)}`,25,y);
      y += 5;
      doc.text(`After 50% work (30%): ${formatINR(d.amount*0.3)}`,25,y);
      y += 5;
      doc.text(`On Completion (20%): ${formatINR(d.amount*0.2)}`,25,y);
      y += 10;
    }
  });
  doc.save("Invoice.pdf");
});
