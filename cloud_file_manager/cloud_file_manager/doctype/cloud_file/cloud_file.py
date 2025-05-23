# Copyright (c) 2025, Manot L. and contributors
# For license information, please see license.txt

from frappe.model.document import Document
import os
import frappe
import base64
import hashlib
from frappe.model.document import Document
from frappe.utils import get_site_path, now, get_files_path
from frappe.utils.file_manager import save_file
from frappe.utils.password import get_decrypted_password
import boto3
from botocore.exceptions import ClientError
import mimetypes
from typing import Optional, Dict, Any, Union


class CloudFileError(Exception):
    """Base exception for Cloud File operations"""

    pass


class FileUploadError(CloudFileError):
    """Raised when file upload fails"""

    pass


class FileValidationError(CloudFileError):
    """Raised when file validation fails"""

    pass


class CloudFileConfig:
    """Centralized configuration for Cloud File Manager"""

    DEFAULT_FOLDER = "public/files/products"
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".csv",
    ]
    CHUNK_SIZE = 1024 * 1024  # 1MB chunks for large files

    @staticmethod
    def get_upload_config():
        """Get upload configuration from system settings"""
        try:
            settings = frappe.get_single("Cloud File Settings")
            return {
                "default_folder": settings.default_folder
                or CloudFileConfig.DEFAULT_FOLDER,
                "max_file_size": settings.max_file_size
                or CloudFileConfig.MAX_FILE_SIZE,
                "allowed_extensions": settings.allowed_extensions.split(",")
                if settings.allowed_extensions
                else CloudFileConfig.ALLOWED_EXTENSIONS,
            }
        except Exception:
            return {
                "default_folder": CloudFileConfig.DEFAULT_FOLDER,
                "max_file_size": CloudFileConfig.MAX_FILE_SIZE,
                "allowed_extensions": CloudFileConfig.ALLOWED_EXTENSIONS,
            }


def handle_cloud_file_error(func):
    """Decorator for standardized error handling"""

    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except CloudFileError as e:
            frappe.log_error(f"Cloud File Error in {func.__name__}: {str(e)}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            frappe.log_error(f"Unexpected error in {func.__name__}: {str(e)}")
            return {"success": False, "error": "An unexpected error occurred"}

    return wrapper


class CloudFile(Document):
    def before_insert(self):
        if not self.uploaded_by:
            self.uploaded_by = frappe.session.user
        if not self.upload_date:
            self.upload_date = now()

        # Generate file hash for duplicate detection
        if self.file_content and not self.file_hash:
            self.file_hash = self.generate_file_hash()

    def validate(self):
        if not self.folder_path:
            self.folder_path = CloudFileConfig.DEFAULT_FOLDER

        # Validate file extension
        if self.file_name:
            ext = os.path.splitext(self.file_name)[1].lower()
            config = CloudFileConfig.get_upload_config()
            if ext not in config["allowed_extensions"]:
                frappe.throw(f"File type {ext} is not allowed")

        # Validate file size
        if (
            self.file_size
            and self.file_size > CloudFileConfig.get_upload_config()["max_file_size"]
        ):
            frappe.throw("File size exceeds maximum allowed size")

        # Check for duplicates
        if self.file_hash and self.is_new():
            self.check_duplicate_file()

    def on_update(self):
        # Update file permissions if changed
        if self.has_value_changed("is_public"):
            self.update_file_permissions()

    def update_file_permissions(self):
        """Update file permissions based on is_public flag"""
        if self.file_url and frappe.db.exists("File", {"file_url": self.file_url}):
            try:
                file_doc = frappe.get_doc("File", {"file_url": self.file_url})
                file_doc.is_private = 0 if self.is_public else 1
                file_doc.save()
            except Exception as e:
                frappe.log_error(f"Error updating file permissions: {str(e)}")

    def generate_file_hash(self) -> str:
        """Generate SHA256 hash of file content"""
        if hasattr(self, "file_content") and self.file_content:
            content = self.file_content
            if isinstance(content, str):
                content = content.encode()
            return hashlib.sha256(content).hexdigest()
        return ""

    def check_duplicate_file(self):
        """Check if file with same hash already exists"""
        if self.file_hash:
            existing = frappe.get_all(
                "Cloud File",
                filters={"file_hash": self.file_hash, "name": ["!=", self.name]},
                limit=1,
            )
            if existing:
                frappe.throw(
                    f"A file with identical content already exists: {existing[0].name}"
                )


class FileValidator:
    """File validation utility class"""

    @staticmethod
    def validate_base64_content(content: Union[str, bytes]) -> bytes:
        """Validate and decode base64 content safely"""
        try:
            if isinstance(content, bytes):
                return content

            if isinstance(content, str):
                # Remove data URL prefix if present
                if content.startswith("data:"):
                    content = content.split(",")[1]

                # Validate base64
                decoded = base64.b64decode(content, validate=True)

                # Size limit check
                config = CloudFileConfig.get_upload_config()
                if len(decoded) > config["max_file_size"]:
                    raise FileValidationError(
                        f"File size {len(decoded)} exceeds limit {config['max_file_size']}"
                    )

                return decoded
        except Exception as e:
            raise FileValidationError(f"Invalid file content: {str(e)}")

    @staticmethod
    def validate_filename(filename: str) -> str:
        """Validate and sanitize filename"""
        if not filename:
            raise FileValidationError("Filename is required")

        # Remove dangerous characters
        safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-")
        if not safe_filename:
            raise FileValidationError("Invalid filename")

        # Check extension
        ext = os.path.splitext(safe_filename)[1].lower()
        config = CloudFileConfig.get_upload_config()
        if ext not in config["allowed_extensions"]:
            raise FileValidationError(f"File type {ext} is not allowed")

        return safe_filename

    @staticmethod
    def check_file_exists(filename: str, folder_path: str) -> bool:
        """Check if file already exists"""
        existing_file = frappe.get_all(
            "Cloud File",
            filters={"file_name": filename, "folder_path": folder_path},
            limit=1,
        )
        return len(existing_file) > 0


class S3Manager:
    """Secure S3 operations manager"""

    @staticmethod
    def get_s3_config() -> Optional[Dict]:
        """Get S3 configuration with secure credential handling"""
        try:
            s3_config = frappe.get_site_config().get("s3_config", {})

            if not s3_config:
                return None

            # Handle encrypted credentials
            if s3_config.get("access_key_encrypted"):
                try:
                    s3_config["access_key"] = get_decrypted_password(
                        "Cloud File Manager", "S3 Access Key"
                    )
                except Exception:
                    frappe.log_error("Failed to decrypt S3 access key")
                    return None

            if s3_config.get("secret_key_encrypted"):
                try:
                    s3_config["secret_key"] = get_decrypted_password(
                        "Cloud File Manager", "S3 Secret Key"
                    )
                except Exception:
                    frappe.log_error("Failed to decrypt S3 secret key")
                    return None

            # Validate required fields
            required_fields = ["access_key", "secret_key", "bucket_name"]
            if not all(s3_config.get(field) for field in required_fields):
                frappe.log_error("Incomplete S3 configuration")
                return None

            return s3_config
        except Exception as e:
            frappe.log_error(f"S3 config error: {str(e)}")
            return None

    @staticmethod
    def upload_to_s3(
        file_content: bytes, filename: str, folder_path: str
    ) -> Optional[str]:
        """Upload file to S3 with proper error handling"""
        try:
            s3_config = S3Manager.get_s3_config()
            if not s3_config:
                return None

            # Initialize S3 client with timeout and retry configuration
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=s3_config.get("access_key"),
                aws_secret_access_key=s3_config.get("secret_key"),
                region_name=s3_config.get("region", "us-east-1"),
                config=boto3.session.Config(
                    retries={"max_attempts": 3}, connect_timeout=60, read_timeout=60
                ),
            )

            bucket_name = s3_config.get("bucket_name")
            s3_key = f"{folder_path.strip('/')}/{filename}"

            # Determine content type
            content_type = (
                mimetypes.guess_type(filename)[0] or "application/octet-stream"
            )

            # Upload with metadata
            s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type,
                Metadata={
                    "uploaded_by": frappe.session.user,
                    "upload_timestamp": str(now()),
                },
            )

            # Return S3 URL
            if s3_config.get("custom_domain"):
                return f"https://{s3_config['custom_domain']}/{s3_key}"
            else:
                return f"https://{bucket_name}.s3.{s3_config.get('region', 'us-east-1')}.amazonaws.com/{s3_key}"

        except ClientError as e:
            frappe.log_error(f"S3 upload failed: {str(e)}")
            return None
        except Exception as e:
            frappe.log_error(f"S3 upload error: {str(e)}")
            return None

    @staticmethod
    def delete_from_s3(s3_url: str) -> bool:
        """Delete file from S3 with proper error handling"""
        try:
            s3_config = S3Manager.get_s3_config()
            if not s3_config:
                return False

            # Parse S3 URL to get bucket and key
            import urllib.parse

            parsed_url = urllib.parse.urlparse(s3_url)

            if (
                s3_config.get("custom_domain")
                and s3_config["custom_domain"] in parsed_url.netloc
            ):
                bucket_name = s3_config["bucket_name"]
                s3_key = parsed_url.path.lstrip("/")
            else:
                bucket_name = parsed_url.netloc.split(".")[0]
                s3_key = parsed_url.path.lstrip("/")

            # Initialize S3 client
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=s3_config.get("access_key"),
                aws_secret_access_key=s3_config.get("secret_key"),
                region_name=s3_config.get("region", "us-east-1"),
            )

            s3_client.delete_object(Bucket=bucket_name, Key=s3_key)
            return True

        except Exception as e:
            frappe.log_error(f"S3 deletion failed: {str(e)}")
            return False


@frappe.whitelist()
@handle_cloud_file_error
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
    Upload file to specified folder and create Cloud File record with enhanced security
    """
    # Validate inputs
    filename = FileValidator.validate_filename(filename)
    file_content_bytes = FileValidator.validate_base64_content(file_content)

    # Check if file already exists
    if FileValidator.check_file_exists(filename, folder_path):
        raise FileValidationError(f"File {filename} already exists in {folder_path}")

    # Ensure folder exists
    ensure_folder_exists(folder_path)

    # Save file using Frappe's file manager
    file_doc = save_file(
        fname=filename,
        content=file_content_bytes,
        dt=reference_doctype,
        dn=reference_docname,
        folder=get_frappe_folder_path(folder_path),
        is_private=0 if folder_path.startswith("public") else 1,
    )

    # Generate file hash
    file_hash = hashlib.sha256(file_content_bytes).hexdigest()

    # Create Cloud File record
    cloud_file = frappe.get_doc(
        {
            "doctype": "Cloud File",
            "file_name": filename,
            "file_url": file_doc.file_url,
            "file_size": len(file_content_bytes),
            "file_type": get_file_extension(filename),
            "file_hash": file_hash,
            "folder_path": folder_path,
            "is_public": 1 if folder_path.startswith("public") else 0,
            "reference_doctype": reference_doctype,
            "reference_docname": reference_docname,
            "description": description,
            "tags": tags,
        }
    )

    # Upload to S3 if configured
    s3_url = S3Manager.upload_to_s3(file_content_bytes, filename, folder_path)
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


@frappe.whitelist()
@handle_cloud_file_error
def upload_multiple_files(files_data):
    """Upload multiple files with transaction safety"""
    results = []
    success_count = 0

    # Use transaction for atomicity
    try:
        for file_data in files_data:
            try:
                result = upload_file_to_products(
                    file_content=file_data.get("content"),
                    filename=file_data.get("filename"),
                    folder_path=file_data.get("folder_path", "public/files/products"),
                    reference_doctype=file_data.get("reference_doctype"),
                    reference_docname=file_data.get("reference_docname"),
                    description=file_data.get("description"),
                    tags=file_data.get("tags"),
                )
                if result.get("success"):
                    success_count += 1
                results.append(result)
            except Exception as e:
                results.append(
                    {
                        "success": False,
                        "error": str(e),
                        "filename": file_data.get("filename", "unknown"),
                    }
                )

        frappe.db.commit()

    except Exception as e:
        frappe.db.rollback()
        raise FileUploadError(f"Batch upload failed: {str(e)}")

    return {
        "success": True,
        "results": results,
        "total_files": len(files_data),
        "successful_uploads": success_count,
    }


def ensure_folder_exists(folder_path):
    """Ensure the folder exists in the file system with proper permissions"""
    try:
        site_path = get_site_path()
        full_path = os.path.join(site_path, folder_path)

        if not os.path.exists(full_path):
            os.makedirs(full_path, mode=0o755, exist_ok=True)
    except Exception as e:
        frappe.log_error(f"Failed to create folder {folder_path}: {str(e)}")
        raise FileUploadError(f"Failed to create folder: {str(e)}")


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


@frappe.whitelist()
def get_files_by_reference(reference_doctype, reference_docname):
    """Get all files linked to a specific document with security checks"""
    # Validate inputs
    if not reference_doctype or not reference_docname:
        return []

    # Check if user has permission to access the referenced document
    if not frappe.has_permission(reference_doctype, "read", reference_docname):
        frappe.throw("No permission to access referenced document")

    return frappe.get_all(
        "Cloud File",
        filters={
            "reference_doctype": reference_doctype,
            "reference_docname": reference_docname,
        },
        fields=["*"],
        order_by="creation desc",
    )


@frappe.whitelist()
@handle_cloud_file_error
def delete_cloud_file(cloud_file_name):
    """Delete cloud file and associated file records with proper cleanup"""
    if not cloud_file_name:
        raise FileValidationError("Cloud file name is required")

    try:
        cloud_file = frappe.get_doc("Cloud File", cloud_file_name)

        # Check permissions
        if not frappe.has_permission("Cloud File", "delete", cloud_file_name):
            frappe.throw("No permission to delete this file")

        # Delete from S3 if exists
        s3_deletion_success = True
        if cloud_file.s3_url:
            s3_deletion_success = S3Manager.delete_from_s3(cloud_file.s3_url)
            if not s3_deletion_success:
                frappe.log_error(f"Failed to delete file from S3: {cloud_file.s3_url}")

        # Delete associated File document
        if cloud_file.file_url:
            try:
                file_docs = frappe.get_all(
                    "File", filters={"file_url": cloud_file.file_url}
                )
                for file_doc in file_docs:
                    frappe.delete_doc("File", file_doc.name, ignore_permissions=True)
            except Exception as e:
                frappe.log_error(f"Failed to delete File document: {str(e)}")

        # Delete Cloud File document
        frappe.delete_doc("Cloud File", cloud_file_name, ignore_permissions=True)
        frappe.db.commit()

        return {"success": True, "s3_deletion_success": s3_deletion_success}

    except frappe.DoesNotExistError:
        raise FileValidationError("Cloud file not found")
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Cloud file deletion failed: {str(e)}")
        raise FileUploadError(f"Failed to delete file: {str(e)}")


@frappe.whitelist()
def search_files(search_term="", file_type=None, folder_path=None, limit=50):
    """Search files with proper filtering and security"""
    if not search_term and not file_type and not folder_path:
        return []

    filters = []

    if search_term:
        # Safe search using LIKE with proper escaping
        search_term = search_term.replace("%", "\\%").replace("_", "\\_")
        filters.append(["file_name", "like", f"%{search_term}%"])

    if file_type:
        filters.append(["file_type", "=", file_type])

    if folder_path:
        filters.append(["folder_path", "like", f"{folder_path}%"])

    # Only return files user has permission to see
    files = frappe.get_all(
        "Cloud File",
        filters=filters,
        fields=[
            "name",
            "file_name",
            "file_url",
            "file_type",
            "folder_path",
            "file_size",
            "creation",
            "s3_url",
            "is_public",
        ],
        limit=int(limit),
        order_by="creation desc",
    )

    # Filter based on permissions
    accessible_files = []
    for file in files:
        try:
            # Check if user can read this file
            if frappe.has_permission("Cloud File", "read", file.name):
                accessible_files.append(file)
        except Exception:
            continue

    return accessible_files


@frappe.whitelist()
def get_file_stats():
    """Get file statistics with caching"""
    cache_key = f"cloud_file_stats_{frappe.session.user}"

    # Try to get from cache first
    stats = frappe.cache().get_value(cache_key)
    if stats:
        return stats

    try:
        # Get basic stats
        total_files = frappe.db.count("Cloud File")

        # Get size statistics
        size_stats = frappe.db.sql(
            """
            SELECT 
                COUNT(*) as count,
                SUM(file_size) as total_size,
                AVG(file_size) as avg_size
            FROM `tabCloud File`
            WHERE file_size IS NOT NULL
        """,
            as_dict=True,
        )[0]

        # Get file type distribution
        type_stats = frappe.db.sql(
            """
            SELECT 
                COALESCE(file_type, 'Not Specified') as file_type,
                COUNT(*) as count
            FROM `tabCloud File`
            GROUP BY file_type
            ORDER BY count DESC
            LIMIT 10
        """,
            as_dict=True,
        )

        # Get recent activity
        recent_uploads = frappe.db.sql(
            """
            SELECT DATE(creation) as date, COUNT(*) as count
            FROM `tabCloud File`
            WHERE creation >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(creation)
            ORDER BY date DESC
        """,
            as_dict=True,
        )

        stats = {
            "total_files": total_files,
            "total_size": size_stats.get("total_size", 0),
            "average_size": size_stats.get("avg_size", 0),
            "file_types": type_stats,
            "recent_activity": recent_uploads,
            "generated_at": now(),
        }

        # Cache for 5 minutes
        frappe.cache().set_value(cache_key, stats, expires_in_sec=300)

        return stats

    except Exception as e:
        frappe.log_error(f"Error getting file stats: {str(e)}")
        return {
            "total_files": 0,
            "total_size": 0,
            "average_size": 0,
            "file_types": [],
            "recent_activity": [],
            "error": "Failed to load statistics",
        }


def cleanup_orphaned_files():
    """Cleanup orphaned file records and physical files"""
    try:
        # Find Cloud File records without corresponding File records
        orphaned_cloud_files = frappe.db.sql(
            """
            SELECT cf.name, cf.file_url
            FROM `tabCloud File` cf
            LEFT JOIN `tabFile` f ON cf.file_url = f.file_url
            WHERE f.name IS NULL AND cf.file_url IS NOT NULL
        """,
            as_dict=True,
        )

        # Find File records without corresponding Cloud File records
        orphaned_files = frappe.db.sql(
            """
            SELECT f.name, f.file_url
            FROM `tabFile` f
            LEFT JOIN `tabCloud File` cf ON f.file_url = cf.file_url
            WHERE cf.name IS NULL AND f.file_url LIKE '%/files/%'
        """,
            as_dict=True,
        )

        deleted_count = 0

        # Clean up orphaned Cloud File records
        for record in orphaned_cloud_files:
            try:
                frappe.delete_doc("Cloud File", record.name, ignore_permissions=True)
                deleted_count += 1
            except Exception as e:
                frappe.log_error(
                    f"Failed to delete orphaned Cloud File {record.name}: {str(e)}"
                )

        # Optionally clean up orphaned File records (be careful with this)
        # for record in orphaned_files:
        #     try:
        #         frappe.delete_doc("File", record.name, ignore_permissions=True)
        #         deleted_count += 1
        #     except Exception as e:
        #         frappe.log_error(f"Failed to delete orphaned File {record.name}: {str(e)}")

        frappe.db.commit()

        return {
            "success": True,
            "deleted_cloud_files": len(orphaned_cloud_files),
            "orphaned_files_found": len(orphaned_files),
            "total_deleted": deleted_count,
        }

    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Cleanup failed: {str(e)}")
        return {"success": False, "error": str(e)}


# Scheduled task functions
def daily_cleanup():
    """Daily maintenance tasks"""
    try:
        # Clean up old temporary files
        temp_files = frappe.get_all(
            "Cloud File",
            filters={
                "folder_path": ["like", "%temp%"],
                "creation": ["<", frappe.utils.add_days(now(), -1)],
            },
        )

        for temp_file in temp_files:
            delete_cloud_file(temp_file.name)

        # Clear old cache entries
        frappe.cache().delete_keys("cloud_file_stats_*")

        frappe.log_error(
            f"Daily cleanup completed: {len(temp_files)} temp files removed"
        )

    except Exception as e:
        frappe.log_error(f"Daily cleanup failed: {str(e)}")


def weekly_maintenance():
    """Weekly maintenance tasks"""
    try:
        # Run orphaned file cleanup
        result = cleanup_orphaned_files()

        # Generate maintenance report
        stats = get_file_stats()

        # Log maintenance summary
        frappe.log_error(
            f"Weekly maintenance completed:\n"
            f"- Total files: {stats.get('total_files', 0)}\n"
            f"- Total size: {stats.get('total_size', 0) / (1024 * 1024):.2f} MB\n"
            f"- Orphaned files cleaned: {result.get('deleted_cloud_files', 0)}"
        )

    except Exception as e:
        frappe.log_error(f"Weekly maintenance failed: {str(e)}")


# Utility functions for backward compatibility
def get_content_type(filename):
    """Get content type based on file extension - deprecated, use mimetypes instead"""
    return mimetypes.guess_type(filename)[0] or "application/octet-stream"
