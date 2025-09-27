from flask import Flask, render_template, request, send_file
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors
import io
import json
from datetime import datetime

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate_invoice():
    customer_name = request.form['customer_name']
    project_address = request.form['project_address']
    invoice_no = request.form['invoice_no']
    items_json = request.form['items']
    gst_percent = float(request.form['gst'])
    timeline = request.form['timeline']

    items = json.loads(items_json)

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, height - 50, "Varshith Interior Solutions")
    c.line(40, height - 60, width - 40, height - 60)

    # Address on left
    c.setFont("Helvetica", 10)
    address_lines = [
        "No 39 BRN Ashish Layout",
        "Near Srithimaraya Swami Temple",
        "Anekal - 562106"
    ]
    y = height - 80
    for line in address_lines:
        c.drawString(50, y, line)
        y -= 12

    # Phone on right
    phone_lines = [
        "Phone: +91 9916511599",
        "       +91 8553608981"
    ]
    y = height - 80
    for line in phone_lines:
        c.drawRightString(width - 50, y, line)
        y -= 12

    # Invoice info
    c.setFont("Helvetica-Bold", 12)
    y -= 20
    c.drawString(50, y, f"Invoice No: {invoice_no}")
    c.drawString(250, y, f"Date: {datetime.today().strftime('%d-%m-%Y')}")
    c.setFont("Helvetica", 12)
    y -= 20
    c.drawString(50, y, f"Customer Name: {customer_name}")
    y -= 20
    c.drawString(50, y, f"Project Address: {project_address}")

    # Table
    table_data = [["Sl. No.", "Work / Item", "Material Used", "Total Cost"]]
    total_cost = 0
    for idx, item in enumerate(items, start=1):
        table_data.append([str(idx), item["work"], item["materials"], f"₹{item['cost']:,}"])
        total_cost += float(item["cost"])

    table = Table(table_data, colWidths=[50, 150, 200, 100])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
        ("TEXTCOLOR", (0,0), (-1,0), colors.black),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,0), 8),
        ("GRID", (0,0), (-1,-1), 1, colors.black),
    ]))
    table.wrapOn(c, width, height)
    table.drawOn(c, 50, y - 200)

    summary_y = y - 240 - (len(table_data) * 18)
    gst_amount = total_cost * gst_percent / 100
    grand_total = total_cost + gst_amount

    c.setFont("Helvetica", 12)
    c.drawRightString(width - 50, summary_y, f"Total (Before Tax): ₹{total_cost:,}")
    c.drawRightString(width - 50, summary_y - 20, f"GST ({gst_percent}%): ₹{gst_amount:,.0f}")
    c.drawRightString(width - 50, summary_y - 40, f"Grand Total: ₹{grand_total:,.0f}")

    # Notes
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(50, summary_y - 80, "Notes:")
    c.drawString(70, summary_y - 100, f"- Work completion timeline: {timeline} days")
    c.drawString(70, summary_y - 115, "- 50% advance, balance upon project completion")

    c.setFont("Helvetica", 12)
    c.drawRightString(width - 50, summary_y - 160, "Authorized Signatory,")
    c.drawRightString(width - 50, summary_y - 180, "Varshith Interior Solutions")

    c.save()
    buffer.seek(0)

    return send_file(buffer, as_attachment=True, download_name=f"Invoice_{invoice_no}.pdf", mimetype='application/pdf')

if __name__ == "__main__":
    app.run(debug=True)