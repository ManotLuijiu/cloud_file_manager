# Cloud File Manager - Installation and Usage Guide

[🇬🇧 English](#english-version) | [🇹🇭 ภาษาไทย](#thai-version--ภาษาไทย)

## 🇬🇧 English Version

This guide will walk you through the process of setting up the Cloud File Manager app and creating the Cloud File DocType using the command-line interface.

### Prerequisites

- Frappe Bench environment
- A running Frappe site

### Installation Steps

1. **Clone the repository**

```bash
cd ~/frappe-bench
bench get-app https://github.com/ManotLuijiu/cloud_file_manager.git
```

2. **Install the app on your site**

```bash
bench --site your-site.local install-app cloud_file_manager
```

3. **Verify the installation**

```bash
bench --site your-site.local list-apps
```

You should see `cloud_file_manager` in the list of installed apps.

### Creating the Cloud File DocType

The Cloud File Manager app comes with a command to create the Cloud File DocType. You can run this command to set up the DocType in your site:

```bash
bench --site your-site.local create-cloud-file-doctype
```

This will create a new DocType named "Cloud File" with the following fields:

- **File URL**: URL of the file in cloud storage (required)
- **File Type**: Type of cloud storage (S3, Google Cloud, Local, Other)
- **Reference DocType**: Link to any DocType in your system
- **Reference DocName**: Name of the document this file is related to

### Using the Cloud File DocType

After creating the DocType, you can:

1. **Access it through the Desk interface**:

   - Go to Desk > Cloud File Manager > Cloud File
   - Create new Cloud File records

2. **Link it to other documents**:

   - When creating a Cloud File record, specify the Reference DocType and DocName

3. **Use it programmatically**:

   ```python
   # Create a new Cloud File record
   import frappe

   def create_cloud_file(file_url, file_type, ref_doctype=None, ref_docname=None):
       doc = frappe.get_doc({
           "doctype": "Cloud File",
           "file_url": file_url,
           "file_type": file_type,
           "ref_doctype": ref_doctype,
           "ref_docname": ref_docname
       })
       doc.insert()
       return doc
   ```

### Dependencies

This application uses `pyproject.toml` for dependency management. All dependencies are defined in this file, which is the modern approach for Python projects, replacing the older `requirements.txt` approach.

The app's dependencies are automatically managed by Frappe bench when you install the app.

### Troubleshooting

If you encounter issues while creating the DocType, try the following:

1. Check if the DocType already exists:

   ```bash
   bench --site your-site.local console
   ```

   Then in the console:

   ```python
   frappe.db.exists("DocType", "Cloud File")
   ```

2. Check the logs for any errors:

   ```bash
   tail -f ~/frappe-bench/logs/bench.log
   ```

3. Make sure you have the necessary permissions:
   The command requires administrator privileges to create new DocTypes.

---

## Thai Version / ภาษาไทย

คู่มือนี้จะแนะนำคุณตลอดกระบวนการตั้งค่าแอป Cloud File Manager และการสร้าง DocType Cloud File โดยใช้อินเทอร์เฟซบรรทัดคำสั่ง

### ข้อกำหนดเบื้องต้น

- สภาพแวดล้อม Frappe Bench
- ไซต์ Frappe ที่กำลังทำงานอยู่

### ขั้นตอนการติดตั้ง

1. **โคลนพื้นที่เก็บข้อมูล**

```bash
cd ~/frappe-bench
bench get-app https://github.com/ManotLuijiu/cloud_file_manager.git
```

2. **ติดตั้งแอปบนไซต์ของคุณ**

```bash
bench --site your-site.local install-app cloud_file_manager
```

3. **ตรวจสอบการติดตั้ง**

```bash
bench --site your-site.local list-apps
```

คุณควรเห็น `cloud_file_manager` ในรายการแอปที่ติดตั้ง

### การสร้าง DocType Cloud File

แอป Cloud File Manager มาพร้อมกับคำสั่งสำหรับสร้าง DocType Cloud File คุณสามารถเรียกใช้คำสั่งนี้เพื่อตั้งค่า DocType ในไซต์ของคุณ:

```bash
bench --site your-site.local create-cloud-file-doctype
```

จะมีการสร้าง DocType ใหม่ชื่อ "Cloud File" พร้อมด้วยฟิลด์ต่อไปนี้:

- **File URL**: URL ของไฟล์ในพื้นที่จัดเก็บคลาวด์ (จำเป็นต้องมี)
- **File Type**: ประเภทของพื้นที่จัดเก็บคลาวด์ (S3, Google Cloud, Local, Other)
- **Reference DocType**: ลิงก์ไปยัง DocType ใดๆ ในระบบของคุณ
- **Reference DocName**: ชื่อของเอกสารที่ไฟล์นี้เกี่ยวข้อง

### การใช้งาน DocType Cloud File

หลังจากสร้าง DocType แล้ว คุณสามารถ:

1. **เข้าถึงผ่านอินเตอร์เฟซ Desk**:

   - ไปที่ Desk > Cloud File Manager > Cloud File
   - สร้างระเบียน Cloud File ใหม่

2. **เชื่อมโยงกับเอกสารอื่นๆ**:

   - เมื่อสร้างระเบียน Cloud File ให้ระบุ Reference DocType และ Reference DocName

3. **ใช้งานโดยการเขียนโปรแกรม**:

   ```python
   # สร้างระเบียน Cloud File ใหม่
   import frappe

   def create_cloud_file(file_url, file_type, ref_doctype=None, ref_docname=None):
       doc = frappe.get_doc({
           "doctype": "Cloud File",
           "file_url": file_url,
           "file_type": file_type,
           "ref_doctype": ref_doctype,
           "ref_docname": ref_docname
       })
       doc.insert()
       return doc
   ```

### การจัดการแพ็คเกจที่ต้องใช้

แอปพลิเคชันนี้ใช้ไฟล์ `pyproject.toml` สำหรับการจัดการแพ็คเกจที่ต้องใช้ แพ็คเกจทั้งหมดถูกกำหนดในไฟล์นี้ ซึ่งเป็นวิธีการปัจจุบันสำหรับโปรเจกต์ Python แทนการใช้ `requirements.txt` แบบเดิม

แพ็คเกจที่จำเป็นของแอปจะถูกจัดการโดยอัตโนมัติโดย Frappe bench เมื่อคุณติดตั้งแอป

### การแก้ไขปัญหา

หากคุณพบปัญหาขณะสร้าง DocType ให้ลองวิธีต่อไปนี้:

1. ตรวจสอบว่า DocType มีอยู่แล้วหรือไม่:

   ```bash
   bench --site your-site.local console
   ```

   จากนั้นในคอนโซล:

   ```python
   frappe.db.exists("DocType", "Cloud File")
   ```

2. ตรวจสอบบันทึกสำหรับข้อผิดพลาด:

   ```bash
   tail -f ~/frappe-bench/logs/bench.log
   ```

3. ตรวจสอบให้แน่ใจว่าคุณมีสิทธิ์ที่จำเป็น:
   คำสั่งนี้ต้องการสิทธิ์ผู้ดูแลระบบเพื่อสร้าง DocTypes ใหม่
