document.getElementById("addRow").addEventListener("click", function() {
    const tbody = document.querySelector("#invoiceTable tbody");
    const row = document.createElement("tr");
    row.innerHTML = `
        <td contenteditable="true">Item</td>
        <td contenteditable="true">Material</td>
        <td contenteditable="true">1</td>
        <td contenteditable="true">0.00</td>
    `;
    tbody.appendChild(row);
    updateTotals();
});

function updateTotals() {
    let total = 0;
    document.querySelectorAll("#invoiceTable tbody tr").forEach(row => {
        const amount = parseFloat(row.cells[3].innerText) || 0;
        total += amount;
    });
    const gst = total * 0.18; // default 18%
    const finalCost = total + gst;
    document.getElementById("totalCost").innerText = total.toFixed(2);
    document.getElementById("gst").innerText = gst.toFixed(2);
    document.getElementById("finalCost").innerText = finalCost.toFixed(2);
}

document.getElementById("invoiceTable").addEventListener("input", updateTotals);

document.getElementById("downloadInvoice").addEventListener("click", function() {
    const html = document.querySelector("main").innerHTML;
    fetch("/download_invoice", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "invoice_html=" + encodeURIComponent(html)
    }).then(res => res.blob())
      .then(blob => {
          const link = document.createElement('a');
          link.href = window.URL.createObjectURL(blob);
          link.download = "invoice.pdf";
          link.click();
      });
});

document.getElementById("uploadForm").addEventListener("submit", function(e){
    e.preventDefault();
    const formData = new FormData(this);
    fetch("/upload_design", {method: "POST", body: formData})
    .then(res => res.json())
    .then(data => {
        document.getElementById("progress").innerText = data.progress;
        if(data.success){
            document.getElementById("preview3d").innerHTML = `<img src="/static/uploads/${data.filename}" width="300">`;
        }
    });
});
