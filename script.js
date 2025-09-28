/* ==========================
  Invoice + 3D Designer Script
========================== */

// ... (all your existing code above remains unchanged) ...

/* ===== PDF generation (updated with note at bottom) ===== */
generatePDFBtn.addEventListener('click', async ()=>{
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','pt','a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  const clientName = document.getElementById('clientName')?.value || '';
  const invoiceNumber = document.getElementById('invoiceNumber')?.value || '';
  const invoiceDate = document.getElementById('invoiceDate')?.value || new Date().toLocaleDateString();
  const gstPercent = parseFloat(gstPercentEl.value)||0;

  // table body
  const body = [];
  invoiceTbody.querySelectorAll('tr').forEach(tr=>{
    const item = tr.querySelector('.item').value || '';
    const material = tr.querySelector('.material').value || '';
    const qty = tr.querySelector('.qty').value || '0';
    const amount = tr.querySelector('.amount').value || '0.00';
    body.push([item, material, qty, amount]);
  });

  const total = parseFloat(totalCostEl.textContent)||0;
  const gstAmount = parseFloat(gstAmountEl.textContent)||0;
  const final = parseFloat(finalCostEl.textContent)||0;

  function drawHeader(data){
    if(logoDataURL){
      try{ doc.addImage(logoDataURL, getImageTypeFromDataURL(logoDataURL), margin, 18, 72, 48); } catch(e){}
    }
    doc.setFontSize(18); doc.setTextColor(20,20,20);
    doc.text("Varshith Interior Solutions", pageWidth/2, 40, { align:'center' });
    doc.setFontSize(10);
    doc.text("NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106", pageWidth/2, 56, { align:'center' });
    doc.text("Phone: +91 9916511599 & +91 8553608981   Email: Varshithinteriorsolutions@gmail.com", pageWidth/2, 70, { align:'center' });
  }
  function drawFooter(data){
    const pageCount = doc.internal.getNumberOfPages();
    const pageNumber = data.pageNumber || pageCount;
    doc.setFontSize(10); doc.setTextColor(100);
    const footerY = pageHeight - 30;
    doc.text("Address: NO 39 BRN Ashish Layout Near Sri Thimmaraya Swami Gudi Anekal - 562106", margin, footerY);
    doc.text("Phone: +91 9916511599 & +91 8553608981 | Email: Varshithinteriorsolutions@gmail.com", margin, footerY + 12);
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin - 60, footerY + 6);
  }

  // header + invoice meta
  drawHeader({});
  const infoY = 90;
  doc.setFontSize(10);
  if(clientName) doc.text(`Client: ${clientName}`, margin, infoY);
  const rightX = pageWidth - margin - 200;
  if(invoiceNumber) doc.text(`Invoice No: ${invoiceNumber}`, rightX, infoY);
  if(invoiceDate) doc.text(`Date: ${invoiceDate}`, rightX, infoY + 12);

  const topStartY = 110;

  try {
    doc.autoTable({
      head:[['Item','Material Used','Qty','Amount']],
      body,
      startY: topStartY,
      theme:'grid',
      styles:{ fontSize:10, cellPadding:6, overflow:'linebreak' },
      headStyles:{ fillColor:[46,125,50], textColor:255, halign:'center' },
      columnStyles:{ 0:{cellWidth:150}, 1:{cellWidth:240}, 2:{cellWidth:50,halign:'center'}, 3:{cellWidth:80,halign:'right'} },
      didDrawPage: function(data){ drawHeader(data); drawFooter(data); },
      margin:{ top: topStartY - 30, bottom: 110 }
    });
  } catch(err){ console.error(err); }

  let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 12 : (topStartY + 20);
  if(finalY + 120 > pageHeight - 40){ doc.addPage(); drawHeader({}); drawFooter({ pageNumber: doc.internal.getNumberOfPages() }); finalY = 80; }

  // Totals
  const totalsX = pageWidth - margin - 220;
  doc.setFontSize(11); doc.setTextColor(30); doc.text("Summary", totalsX, finalY);
  doc.setFontSize(10);
  doc.text(`Total Cost:`, totalsX, finalY + 18); doc.text(`${(total).toFixed(2)}`, totalsX + 140, finalY + 18, { align:'right' });
  doc.text(`GST (${gstPercent}%):`, totalsX, finalY + 36); doc.text(`${(gstAmount).toFixed(2)}`, totalsX + 140, finalY + 36, { align:'right' });
  doc.setFont(undefined,'bold'); doc.text(`Final Cost:`, totalsX, finalY + 56); doc.text(`${(final).toFixed(2)}`, totalsX + 140, finalY + 56, { align:'right' }); doc.setFont(undefined,'normal');

  /* 🟢 Note placement at bottom */
  const bottomY = pageHeight - 100;
  doc.setDrawColor(150); doc.setLineWidth(0.5);
  doc.line(margin, bottomY - 6, pageWidth - margin, bottomY - 6);
  doc.setFontSize(10);
  const noteText = document.getElementById('note').value.replace(/^Note:\s*/i, "");
  const wrappedNote = doc.splitTextToSize(noteText, pageWidth - 2*margin);
  doc.text(wrappedNote, margin, bottomY);

  // Embed designs after note
  let currY = bottomY + 40;
  for(const d of designs){
    const embed = d.snapshot || d.dataURL;
    if(!embed) continue;
    if(currY + 200 > pageHeight - 40){ doc.addPage(); drawHeader({}); drawFooter({ pageNumber: doc.internal.getNumberOfPages() }); currY = 80; }
    doc.setFontSize(10); doc.text(`Design: ${d.name}`, margin, currY);
    currY += 14;
    try {
      const typ = getImageTypeFromDataURL(embed);
      doc.addImage(embed, typ, margin, currY, 260, 180);
    } catch(e){ console.warn('Embed design failed', e); }
    currY += 200;
  }

  doc.save(`Invoice_${invoiceNumber || Date.now()}.pdf`);
});
