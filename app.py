from flask import Flask, render_template, request, send_file
from werkzeug.utils import secure_filename
import os
import pdfkit

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg'}

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route("/upload_design", methods=["POST"])
def upload_design():
    if 'design' not in request.files:
        return {"success": False, "progress": "No file part"}
    file = request.files['design']
    if file.filename == '':
        return {"success": False, "progress": "No selected file"}
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        # Simulate 3D generation progress
        return {"success": True, "filename": filename, "progress": "3D Generation Complete"}
    return {"success": False, "progress": "File type not allowed"}

@app.route("/download_invoice", methods=["POST"])
def download_invoice():
    html = request.form.get("invoice_html")
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], "invoice.pdf")
    pdfkit.from_string(html, pdf_path)
    return send_file(pdf_path, as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True)
