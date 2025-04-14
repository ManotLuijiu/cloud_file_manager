# Cloud File Manager

[🇬🇧 English](#english-version) | [🇹🇭 ภาษาไทย](#thai-version--ภาษาไทย)

<details>
## 🇬🇧 English Version

Stores file metadata (S3 URLs, etc.), can be related to any document in any app.

## Installation

1. Install Frappe Bench: [https://github.com/frappe/bench](https://github.com/frappe/bench)
2. Create a new site: `bench new-site mysite.local`
3. Get the Cloud File Manager app: `bench get-app https://github.com/ManotLuijiu/cloud_file_manager.git`
4. Install the app on your site: `bench --site mysite.local install-app cloud_file_manager`

## Usage

### Creating the Cloud File DocType

You can create the Cloud File DocType using the provided command:

```bash
bench --site mysite.local create-cloud-file-doctype
```

This will create a new DocType with the following fields:

- File URL
- File Type (S3, Google Cloud, Local, Other)
- Reference DocType
- Reference DocName

### Using the Cloud File DocType

Once created, you can use the Cloud File DocType to store file metadata. This is particularly useful for:

- Managing files stored in cloud storage
- Creating references to files from other DocTypes
- Maintaining file metadata independent of the actual file storage

## License

MIT License

</details>

<details>
## Thai Version / ภาษาไทย

จัดเก็บเมตาดาต้าของไฟล์ (URL ของ S3 เป็นต้น) สามารถเชื่อมโยงกับเอกสารใดๆ ในแอปพลิเคชันใดๆ

## การติดตั้ง

1. ติดตั้ง Frappe Bench: [https://github.com/frappe/bench](https://github.com/frappe/bench)
2. สร้างไซต์ใหม่: `bench new-site mysite.local`
3. ดาวน์โหลดแอป Cloud File Manager: `bench get-app https://github.com/ManotLuijiu/cloud_file_manager.git`
4. ติดตั้งแอปบนไซต์ของคุณ: `bench --site mysite.local install-app cloud_file_manager`

## การใช้งาน

### การสร้าง DocType Cloud File

คุณสามารถสร้าง DocType Cloud File โดยใช้คำสั่งที่ให้มา:

```bash
bench --site mysite.local create-cloud-file-doctype
```

คำสั่งนี้จะสร้าง DocType ใหม่พร้อมฟิลด์ต่อไปนี้:

- File URL (URL ของไฟล์)
- File Type (ประเภทไฟล์: S3, Google Cloud, Local, Other)
- Reference DocType (DocType อ้างอิง)
- Reference DocName (ชื่อเอกสารอ้างอิง)

### การใช้งาน DocType Cloud File

เมื่อสร้างแล้ว คุณสามารถใช้ DocType Cloud File เพื่อจัดเก็บข้อมูลเมตาดาต้าของไฟล์ ซึ่งมีประโยชน์สำหรับ:

- การจัดการไฟล์ที่จัดเก็บในคลาวด์สตอเรจ
- การสร้างการอ้างอิงไฟล์จาก DocTypes อื่นๆ
- การรักษาเมตาดาต้าของไฟล์แยกจากพื้นที่จัดเก็บไฟล์จริง

## ใบอนุญาต

MIT License

</details>
