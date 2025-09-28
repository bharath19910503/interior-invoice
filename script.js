let designs = [];

function formatINR(amount) {
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function addDesign() {
  const id = Date.now();
  designs.push({ id, name: '', amount: 0, thumb: '#' });
  renderDesigns();
}

function removeDesign(id) {
  designs = designs.filter(d => d.id !== id);
  renderDesigns();
  updatePaymentBreakdown();
}

function renderDesigns() {
  const container = document.querySelector('.design-list');
  container.innerHTML = '';
  designs.forEach(d => {
    const div = document.createElement('div');
    div.className = 'design-item';
    div.dataset.id = d.id;
    div.innerHTML = `
      <img class="design-thumb" src="${d.thumb}" alt="Thumbnail">
      <div class="design-info">
        <input type="text" value="${d.name}" placeholder="Designer Name" class="designer-name">
        <input type="number" value="${d.amount}" placeholder="Amount (INR)" class="design-amount" min="0">
        <div class="payment-breakdown" style="font-size:12px; color:#555; margin-top:4px;">
          Advance (50%): ${formatINR(d.amount*0.5)} | After 50% work (30%): ${formatINR(d.amount*0.3)} | On Completion (20%): ${formatINR(d.amount*0.2)}
        </div>
      </div>
      <div class="design-controls">
        <button class="deleteBtn">Delete</button>
      </div>
    `;
    container.appendChild(div);

    div.querySelector('.design-amount').addEventListener('input', (e) => {
      d.amount = parseFloat(e.target.value) || 0;
      updateDesignPayment(div, d.amount);
    });
    div.querySelector('.designer-name').addEventListener('input', (e) => {
      d.name = e.target.value;
    });
    div.querySelector('.deleteBtn').addEventListener('click', () => removeDesign(d.id));
  });
  updatePaymentBreakdown();
}

function updateDesignPayment(div, amount) {
  const pb = div.querySelector('.payment-breakdown');
  pb.innerHTML = `
    Advance (50%): ${formatINR(amount*0.5)} | After 50% work (30%): ${formatINR(amount*0.3)} | On Completion (20%): ${formatINR(amount*0.2)}
  `;
  updatePaymentBreakdown();
}

function updatePaymentBreakdown() {
  let total = designs.reduce((sum, d) => sum + (d.amount || 0), 0);
  const advance = total*0.5, mid = total*0.3, final = total*0.2;
  const div = document.getElementById('paymentBreakdown');
  div.innerHTML = `
    <strong>Total Payment Breakdown (INR):</strong>
    <div>Advance (50%): ${formatINR(advance)}</div>
    <div>After 50% work (30%): ${formatINR(mid)}</div>
    <div>On Completion (20%): ${formatINR(final)}</div>
  `;
}

// PDF Generation
async function generatePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 20;
  doc.setFontSize(16);
  doc.text("Invoice", 105, y, { align: "center" });

  y += 10;
  designs.forEach(d => {
    doc.setFontSize(12);
    doc.text(`Designer: ${d.name}`, 20, y);
    doc.text(`Amount: ${formatINR(d.amount)}`, 120, y);
    y += 6;
    doc.text(`Advance (50%): ${formatINR(d.amount*0.5)}`, 25, y);
    y += 5;
    doc.text(`After 50% work (30%): ${formatINR(d.amount*0.3)}`, 25, y);
    y += 5;
    doc.text(`On Completion (20%): ${formatINR(d.amount*0.2)}`, 25, y);
    y += 10;
  });

  // Total
  let total = designs.reduce((sum,d)=>sum+(d.amount||0),0);
  doc.setFontSize(14);
  doc.text("Total Payment Breakdown:", 20, y);
  y += 6;
  doc.setFontSize(12);
  doc.text(`Advance (50%): ${formatINR(total*0.5)}`, 25, y);
  y += 5;
  doc.text(`After 50% work (30%): ${formatINR(total*0.3)}`, 25, y);
  y += 5;
  doc.text(`On Completion (20%): ${formatINR(total*0.2)}`, 25, y);

  doc.save("invoice.pdf");
}

// Event Listeners
document.getElementById('addDesignBtn').addEventListener('click', addDesign);
document.getElementById('generatePdfBtn').addEventListener('click', generatePDF);
