# Copyright (c) 2025, Manot L. and contributors
# For license information, please see license.txt

from frappe.model.document import Document
import os
import frappe
from frappe.model.document import Document
from frappe.utils import get_site_path, now, get_files_path
from frappe.utils.file_manager import save_file
import boto3
from botocore.exceptions import ClientError


class CloudFile(Document):
    def before_insert(self):
        if not self.uploaded_by:
            self.uploaded_by = frappe.session.user
        if not self.upload_date:
            self.upload_date = now()

    def validate(self):
        if not self.folder_path:
            self.folder_path = "public/files/products"

    def on_update(self):
        # Update file permissions if changed
        if self.has_value_changed("is_public"):
            self.update_file_permissions()

    def update_file_permissions(self):
        """Update file permissions based on is_public flag"""
        if self.file_url and frappe.db.exists("File", {"file_url": self.file_url}):
            file_doc = frappe.get_doc("File", {"file_url": self.file_url})
            file_doc.is_private = 0 if self.is_public else 1
            file_doc.save()


@frappe.whitelist()
def upload_file_to_products(
    file_content,
    filename,
    folder_path="public/files/products",
    reference_doctype=None,
    reference_docname=None,
    description=None,
    tags=None,
):
    """
    Upload file to specified folder and create Cloud File record

    Args:
        file_content: File content (base64 or binary)
        filename: Name of the file
        folder_path: Destination folder path
        reference_doctype: Related document type
        reference_docname: Related document name
        description: File description
        tags: File tags

    Returns:
        dict: Cloud File document data
    """
    try:
        # Ensure folder exists
        ensure_folder_exists(folder_path)

        # Save file using Frappe's file manager
        file_doc = save_file(
            fname=filename,
            content=file_content,
            dt=reference_doctype,
            dn=reference_docname,
            folder=get_frappe_folder_path(folder_path),
            is_private=0 if folder_path.startswith("public") else 1,
        )

        # Create Cloud File record
        cloud_file = frappe.get_doc(
            {
                "doctype": "Cloud File",
                "file_name": filename,
                "file_url": file_doc.file_url,
                "file_size": len(file_content)
                if isinstance(file_content, bytes)
                else len(file_content.encode()),
                "file_type": get_file_extension(filename),
                "folder_path": folder_path,
                "is_public": 1 if folder_path.startswith("public") else 0,
                "reference_doctype": reference_doctype,
                "reference_docname": reference_docname,
                "description": description,
                "tags": tags,
            }
        )

        # Upload to S3 if configured
        s3_url = upload_to_s3(file_content, filename, folder_path)
        if s3_url:
            cloud_file.s3_url = s3_url

        cloud_file.insert()
        frappe.db.commit()

        return {
            "success": True,
            "cloud_file": cloud_file.as_dict(),
            "file_url": file_doc.file_url,
            "s3_url": s3_url,
        }

    except Exception as e:
        frappe.log_error(f"File upload failed: {str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def upload_multiple_files(files_data):
    """
    Upload multiple files at once

    Args:
        files_data: List of file data dictionaries

    Returns:
        dict: Upload results
    """
    results = []

    for file_data in files_data:
        result = upload_file_to_products(
            file_content=file_data.get("content"),
            filename=file_data.get("filename"),
            folder_path=file_data.get("folder_path", "public/files/products"),
            reference_doctype=file_data.get("reference_doctype"),
            reference_docname=file_data.get("reference_docname"),
            description=file_data.get("description"),
            tags=file_data.get("tags"),
        )
        results.append(result)

    return {
        "success": True,
        "results": results,
        "total_files": len(files_data),
        "successful_uploads": len([r for r in results if r.get("success")]),
    }


def ensure_folder_exists(folder_path):
    """Ensure the folder exists in the file system"""
    site_path = get_site_path()
    full_path = os.path.join(site_path, folder_path)

    if not os.path.exists(full_path):
        os.makedirs(full_path, exist_ok=True)


def get_frappe_folder_path(folder_path):
    """Convert file system path to Frappe folder path"""
    if folder_path.startswith("public/files/"):
        return f"Home/{folder_path.replace('public/files/', '')}"
    elif folder_path.startswith("private/files/"):
        return f"Home/Private/{folder_path.replace('private/files/', '')}"
    else:
        return "Home"


def get_file_extension(filename):
    """Get file extension from filename"""
    return os.path.splitext(filename)[1].lower()


def upload_to_s3(file_content, filename, folder_path):
    """
    Upload file to S3 if configured

    Args:
        file_content: File content
        filename: File name
        folder_path: Folder path

    Returns:
        str: S3 URL or None
    """
    try:
        # Get S3 configuration from site config
        s3_config = frappe.get_site_config().get("s3_config")
        if not s3_config:
            return None

        # Initialize S3 client
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=s3_config.get("access_key"),
            aws_secret_access_key=s3_config.get("secret_key"),
            region_name=s3_config.get("region", "us-east-1"),
        )

        # Upload to S3
        bucket_name = s3_config.get("bucket_name")
        s3_key = f"{folder_path}/{filename}"

        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=file_content,
            ContentType=get_content_type(filename),
        )

        # Return S3 URL
        return f"https://{bucket_name}.s3.amazonaws.com/{s3_key}"

    except Exception as e:
        frappe.log_error(f"S3 upload failed: {str(e)}")
        return None


def get_content_type(filename):
    """Get content type based on file extension"""
    extension = get_file_extension(filename)
    content_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".txt": "text/plain",
        ".csv": "text/csv",
    }
    return content_types.get(extension, "application/octet-stream")


@frappe.whitelist()
def get_files_by_reference(reference_doctype, reference_docname):
    """Get all files linked to a specific document"""
    return frappe.get_all(
        "Cloud File",
        filters={
            "reference_doctype": reference_doctype,
            "reference_docname": reference_docname,
        },
        fields=["*"],
    )


@frappe.whitelist()
def delete_cloud_file(cloud_file_name):
    """Delete cloud file and associated file records"""
    try:
        cloud_file = frappe.get_doc("Cloud File", cloud_file_name)

        # Delete from S3 if exists
        if cloud_file.s3_url:
            delete_from_s3(cloud_file.s3_url)

        # Delete associated File document
        if cloud_file.file_url:
            file_doc = frappe.get_doc("File", {"file_url": cloud_file.file_url})
            file_doc.delete()

        # Delete Cloud File document
        cloud_file.delete()
        frappe.db.commit()

        return {"success": True}

    except Exception as e:
        frappe.log_error(f"Cloud file deletion failed: {str(e)}")
        return {"success": False, "error": str(e)}


def delete_from_s3(s3_url):
    """Delete file from S3"""
    try:
        s3_config = frappe.get_site_config().get("s3_config")
        if not s3_config:
            return

        # Parse S3 URL to get bucket and key
        import urllib.parse

        parsed_url = urllib.parse.urlparse(s3_url)
        bucket_name = parsed_url.netloc.split(".")[0]
        s3_key = parsed_url.path.lstrip("/")

        # Initialize S3 client and delete
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=s3_config.get("access_key"),
            aws_secret_access_key=s3_config.get("secret_key"),
            region_name=s3_config.get("region", "us-east-1"),
        )

        s3_client.delete_object(Bucket=bucket_name, Key=s3_key)

    except Exception as e:
        frappe.log_error(f"S3 deletion failed: {str(e)}")
