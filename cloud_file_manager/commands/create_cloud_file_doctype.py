import frappe
import json
import os

def create_cloud_file_doctype():
    """Create the Cloud File DocType"""
    
    # Define the DocType
    doctype = {
        "doctype": "DocType",
        "name": "Cloud File",
        "module": "Cloud File Manager",
        "custom": 0,
        "fields": [
            {
                "fieldname": "file_url",
                "fieldtype": "Data",
                "label": "File URL",
                "reqd": 1
            },
            {
                "fieldname": "file_type",
                "fieldtype": "Select",
                "options": "S3\nGoogle Cloud\nLocal\nOther",
                "label": "File Type"
            },
            {
                "fieldname": "ref_doctype",
                "fieldtype": "Link",
                "options": "DocType",
                "label": "Reference Doctype"
            },
            {
                "fieldname": "ref_docname",
                "fieldtype": "Data",
                "label": "Reference Docname"
            }
        ],
        "permissions": [
            {
                "role": "System Manager",
                "read": 1,
                "write": 1,
                "create": 1,
                "delete": 1
            }
        ]
    }
    
    # Check if DocType already exists
    if frappe.db.exists("DocType", "Cloud File"):
        print("DocType 'Cloud File' already exists.")
        return
    
    # Create DocType
    doc = frappe.get_doc(doctype)
    doc.insert()
    
    print("DocType 'Cloud File' created successfully.")

def execute():
    """Execute the command to create Cloud File DocType"""
    try:
        create_cloud_file_doctype()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    execute()