let invoiceTable = document.getElementById('invoiceTable').querySelector('tbody');
let addItemBtn = document.getElementById('addItemBtn');
let gstInput = document.getElementById('gstInput');
let totalCostSpan = document.getElementById('totalCost');
let gstAmountSpan = document.getElementById('gstAmount');
let finalCostSpan = document.getElementById('finalCost');
let downloadPdfBtn = document.getElementById('downloadPdfBtn');

function recalcTotals() {
    let total = 0;
    invoiceTable.querySelectorAll('tr').forEach(row => {
        let amount = parseFloat(row.querySelector('.amount').value) || 0;
        total += amount;
    });
    let gst = parseFloat(gstInput.value) || 0;
    let gstAmount = total * gst / 100;
    let finalCost = total + gstAmount;
    totalCostSpan.textContent = total.toFixed(2);
    gstAmountSpan.textContent = gstAmount.toFixed(2);
    finalCostSpan.textContent = finalCost.toFixed(2);
}

function addItem() {
    let row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="item" placeholder="Item"></td>
        <td><input type="text" class="material" placeholder="Material Used"></td>
        <td><input type="number" class="qty" value="1"></td>
        <td><input type="number" class="amount" value="0"></td>
        <td><button class="deleteBtn">Delete</button></td>
    `;
    invoiceTable.appendChild(row);

    row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', recalcTotals);
    });

    row.querySelector('.deleteBtn').addEventListener('click', () => {
        row.remove();
        recalcTotals();
    });
}

addItemBtn.addEventListener('click', addItem);
gstInput.addEventListener('input', recalcTotals);

downloadPdfBtn.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    let doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text("Varshith Interior Solution", 20, 20);

    // Table
    let startY = 30;
    let rowHeight = 10;
    invoiceTable.querySelectorAll('tr').forEach((row, index) => {
        let y = startY + index * rowHeight;
        doc.text(row.querySelector('.item').value, 20, y);
        doc.text(row.querySelector('.material').value, 60, y);
        doc.text(row.querySelector('.qty').value, 120, y);
        doc.text(row.querySelector('.amount').value, 150, y);
    });

    // Totals
    let totalsY = startY + invoiceTable.querySelectorAll('tr').length * rowHeight + 10;
    doc.text(`Total Cost: ${totalCostSpan.textContent}`, 20, totalsY);
    doc.text(`GST: ${gstAmountSpan.textContent}`, 20, totalsY + 10);
    doc.text(`Final Cost: ${finalCostSpan.textContent}`, 20, totalsY + 20);

    doc.save('invoice.pdf');
});

// 3D Design using Three.js
let generate3DBtn = document.getElementById('generate3DBtn');
let designUpload = document.getElementById('designUpload');
let progressBar = document.getElementById('progressBar');
let threeContainer = document.getElementById('threeContainer');
let scene, camera, renderer, cube;

generate3DBtn.addEventListener('click', () => {
    if (!designUpload.files[0]) {
        alert("Upload a 2D design first!");
        return;
    }

    let reader = new FileReader();
    reader.onload = function(e) {
        let texture = new THREE.TextureLoader().load(e.target.result);

        if (!scene) {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, threeContainer.clientWidth / 400, 0.1, 1000);
            renderer = new THREE.WebGLRenderer();
            renderer.setSize(threeContainer.clientWidth, 400);
            threeContainer.innerHTML = '';
            threeContainer.appendChild(renderer.domElement);
        }

        cube = new THREE.Mesh(new THREE.BoxGeometry(2,2,2), new THREE.MeshBasicMaterial({ map: texture }));
        scene.add(cube);
        camera.position.z = 5;

        // Progress simulation
        progressBar.style.width = '0%';
        let progress = 0;
        let interval = setInterval(() => {
            progress += 10;
            progressBar.style.width = progress + '%';
            if (progress >= 100) clearInterval(interval);
        }, 100);

        function animate() {
            requestAnimationFrame(animate);
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
            renderer.render(scene, camera);
        }
        animate();
    }
    reader.readAsDataURL(designUpload.files[0]);
});
