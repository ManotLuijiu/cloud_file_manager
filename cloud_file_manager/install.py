import os
import frappe
from frappe import _
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def after_install():
    """Post-installation setup"""
    try:
        create_cloud_file_settings()
        create_custom_roles()
        create_default_folders()
        setup_default_permissions()
        frappe.msgprint(
            _("Cloud File Manager installed successfully!"), indicator="green"
        )
    except Exception as e:
        frappe.log_error(f"Post-install error: {str(e)}")
        frappe.throw(_("Installation completed with some errors. Check error logs."))


def create_indexes():
    """Create database indexes for better performance"""
    indexes = [
        # Performance indexes
        "CREATE INDEX IF NOT EXISTS idx_cloud_file_type ON `tabCloud File` (file_type)",
        "CREATE INDEX IF NOT EXISTS idx_cloud_file_folder ON `tabCloud File` (folder_path)",
        "CREATE INDEX IF NOT EXISTS idx_cloud_file_ref ON `tabCloud File` (reference_doctype, reference_docname)",
        "CREATE INDEX IF NOT EXISTS idx_cloud_file_created ON `tabCloud File` (creation)",
        "CREATE INDEX IF NOT EXISTS idx_cloud_file_size ON `tabCloud File` (file_size)",
        "CREATE INDEX IF NOT EXISTS idx_cloud_file_public ON `tabCloud File` (is_public)",
        "CREATE INDEX IF NOT EXISTS idx_cloud_file_hash ON `tabCloud File` (file_hash)",
        # Composite indexes for common queries
        "CREATE INDEX IF NOT EXISTS idx_cloud_file_type_folder ON `tabCloud File` (file_type, folder_path)",
        "CREATE INDEX IF NOT EXISTS idx_cloud_file_ref_created ON `tabCloud File` (reference_doctype, reference_docname, creation)",
        "CREATE INDEX IF NOT EXISTS idx_cloud_file_public_type ON `tabCloud File` (is_public, file_type)",
    ]

    for index_sql in indexes:
        try:
            frappe.db.sql(index_sql)
            frappe.db.commit()
        except Exception as e:
            # Index might already exist, log but don't fail
            frappe.log_error(f"Index creation warning: {str(e)}")


def setup_default_settings():
    """Create default settings document"""
    if not frappe.db.exists("Singles", "Cloud File Settings"):
        settings = frappe.get_doc(
            {
                "doctype": "Cloud File Settings",
                "default_folder": "public/files/products",
                "max_file_size": 10485760,  # 10MB
                "allowed_extensions": ".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.csv",
                "enable_s3_upload": 0,
                "auto_organize_files": 1,
                "enable_duplicate_check": 1,
                "cache_file_stats": 1,
                "cleanup_temp_files": 1,
                "temp_file_retention_days": 1,
                "enable_file_versioning": 0,
                "max_versions_per_file": 5,
            }
        )
        settings.insert(ignore_permissions=True)
        frappe.db.commit()


def create_cloud_file_settings():
    """Create Cloud File Settings DocType if it doesn't exist"""

    if not frappe.db.exists("DocType", "Cloud File Settings"):
        settings_doctype = frappe.get_doc(
            {
                "doctype": "DocType",
                "name": "Cloud File Settings",
                "module": "Cloud File Manager",
                "custom": 0,
                "is_single": 1,
                "track_changes": 1,
                "fields": [
                    {
                        "fieldname": "general_section",
                        "fieldtype": "Section Break",
                        "label": "General Settings",
                    },
                    {
                        "fieldname": "default_folder",
                        "fieldtype": "Data",
                        "label": "Default Folder Path",
                        "default": "public/files/products",
                        "description": "Default folder for file uploads",
                    },
                    {
                        "fieldname": "max_file_size",
                        "fieldtype": "Int",
                        "label": "Max File Size (bytes)",
                        "default": 10485760,
                        "description": "Maximum file size allowed (10MB = 10485760 bytes)",
                    },
                    {
                        "fieldname": "allowed_extensions",
                        "fieldtype": "Text",
                        "label": "Allowed File Extensions",
                        "default": ".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.csv",
                        "description": "Comma-separated list of allowed file extensions",
                    },
                    {"fieldname": "column_break_1", "fieldtype": "Column Break"},
                    {
                        "fieldname": "auto_organize_files",
                        "fieldtype": "Check",
                        "label": "Auto-organize Files by Type",
                        "default": 1,
                    },
                    {
                        "fieldname": "enable_duplicate_check",
                        "fieldtype": "Check",
                        "label": "Enable Duplicate File Check",
                        "default": 1,
                    },
                    {
                        "fieldname": "cache_file_stats",
                        "fieldtype": "Check",
                        "label": "Cache File Statistics",
                        "default": 1,
                    },
                    {
                        "fieldname": "s3_section",
                        "fieldtype": "Section Break",
                        "label": "S3 Configuration",
                    },
                    {
                        "fieldname": "enable_s3_upload",
                        "fieldtype": "Check",
                        "label": "Enable S3 Upload",
                        "default": 0,
                    },
                    {
                        "fieldname": "s3_bucket_name",
                        "fieldtype": "Data",
                        "label": "S3 Bucket Name",
                        "depends_on": "enable_s3_upload",
                    },
                    {
                        "fieldname": "s3_region",
                        "fieldtype": "Data",
                        "label": "S3 Region",
                        "default": "us-east-1",
                        "depends_on": "enable_s3_upload",
                    },
                    {"fieldname": "column_break_2", "fieldtype": "Column Break"},
                    {
                        "fieldname": "s3_custom_domain",
                        "fieldtype": "Data",
                        "label": "Custom Domain (optional)",
                        "depends_on": "enable_s3_upload",
                    },
                    {
                        "fieldname": "s3_access_key_encrypted",
                        "fieldtype": "Check",
                        "label": "S3 Credentials Encrypted",
                        "default": 1,
                        "depends_on": "enable_s3_upload",
                    },
                    {
                        "fieldname": "cleanup_section",
                        "fieldtype": "Section Break",
                        "label": "Cleanup Settings",
                    },
                    {
                        "fieldname": "cleanup_temp_files",
                        "fieldtype": "Check",
                        "label": "Auto-cleanup Temp Files",
                        "default": 1,
                    },
                    {
                        "fieldname": "temp_file_retention_days",
                        "fieldtype": "Int",
                        "label": "Temp File Retention (days)",
                        "default": 1,
                        "depends_on": "cleanup_temp_files",
                    },
                    {"fieldname": "column_break_3", "fieldtype": "Column Break"},
                    {
                        "fieldname": "enable_file_versioning",
                        "fieldtype": "Check",
                        "label": "Enable File Versioning",
                        "default": 0,
                    },
                    {
                        "fieldname": "max_versions_per_file",
                        "fieldtype": "Int",
                        "label": "Max Versions per File",
                        "default": 5,
                        "depends_on": "enable_file_versioning",
                    },
                ],
                "permissions": [
                    {"role": "System Manager", "read": 1, "write": 1, "create": 1},
                    {"role": "File Manager", "read": 1, "write": 1},
                ],
            }
        )

        settings_doctype.insert(ignore_permissions=True)
        frappe.db.commit()


def create_custom_roles():
    """Create custom roles for Cloud File Manager"""
    roles = [
        {
            "role_name": "File Manager",
            "description": "Can manage cloud files and settings",
        },
        {"role_name": "File Viewer", "description": "Can only view and download files"},
        {
            "role_name": "File Uploader",
            "description": "Can upload and manage own files",
        },
    ]

    for role_data in roles:
        if not frappe.db.exists("Role", role_data["role_name"]):
            frappe.get_doc(
                {
                    "doctype": "Role",
                    "role_name": role_data["role_name"],
                    "description": role_data["description"],
                }
            ).insert(ignore_permissions=True)

    frappe.db.commit()


def setup_default_permissions():
    """Setup default permissions for Cloud File doctype"""

    # Enhanced permissions for different roles
    permissions = [
        # System Manager - Full access
        {
            "role": "System Manager",
            "permlevel": 0,
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1,
            "submit": 0,
            "cancel": 0,
            "amend": 0,
            "report": 1,
            "export": 1,
            "import": 1,
            "share": 1,
            "print": 1,
            "email": 1,
        },
        # File Manager - Manage files but not system settings
        {
            "role": "File Manager",
            "permlevel": 0,
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1,
            "submit": 0,
            "cancel": 0,
            "amend": 0,
            "report": 1,
            "export": 1,
            "import": 0,
            "share": 1,
            "print": 1,
            "email": 1,
        },
        # File Uploader - Can create and manage own files
        {
            "role": "File Uploader",
            "permlevel": 0,
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1,
            "submit": 0,
            "cancel": 0,
            "amend": 0,
            "report": 1,
            "export": 0,
            "import": 0,
            "share": 0,
            "print": 1,
            "email": 0,
            "if_owner": 1,  # Can only manage own files
        },
        # File Viewer - Read-only access
        {
            "role": "File Viewer",
            "permlevel": 0,
            "read": 1,
            "write": 0,
            "create": 0,
            "delete": 0,
            "submit": 0,
            "cancel": 0,
            "amend": 0,
            "report": 1,
            "export": 0,
            "import": 0,
            "share": 0,
            "print": 1,
            "email": 0,
        },
    ]

    # Clear existing permissions first
    frappe.db.delete(
        "Custom DocPerm", {"parent": "Cloud File", "parenttype": "DocType"}
    )

    # Add new permissions
    for perm in permissions:
        frappe.get_doc(
            {
                "doctype": "Custom DocPerm",
                "parent": "Cloud File",
                "parenttype": "DocType",
                "parentfield": "permissions",
                **perm,
            }
        ).insert(ignore_permissions=True)

    frappe.db.commit()


def create_default_folders():
    """Create default folder structure"""

    default_folders = [
        "public/files/products",
        "public/files/products/images",
        "public/files/documents",
        "public/files/documents/pdf",
        "public/files/documents/word",
        "public/files/documents/excel",
        "private/files/confidential",
        "private/files/temp",
    ]

    import os
    from frappe.utils import get_site_path

    site_path = get_site_path()

    for folder in default_folders:
        folder_path = os.path.join(site_path, folder)
        try:
            os.makedirs(folder_path, mode=0o755, exist_ok=True)
        except Exception as e:
            frappe.log_error(f"Failed to create folder {folder}: {str(e)}")


def add_custom_fields():
    """Add custom fields to integrate with other doctypes"""

    # Add Cloud Files section to common doctypes
    custom_fields = {
        "Item": [
            {
                "fieldname": "cloud_files_section",
                "fieldtype": "Section Break",
                "label": "Cloud Files",
                "collapsible": 1,
                "insert_after": "description",
            },
            {
                "fieldname": "cloud_files_html",
                "fieldtype": "HTML",
                "label": "Cloud Files",
                "options": '<div id="cloud-files-container"></div>',
                "insert_after": "cloud_files_section",
            },
        ],
        "Customer": [
            {
                "fieldname": "cloud_files_section",
                "fieldtype": "Section Break",
                "label": "Attachments",
                "collapsible": 1,
                "insert_after": "represents_company",
            },
            {
                "fieldname": "cloud_files_html",
                "fieldtype": "HTML",
                "options": '<div id="cloud-files-container"></div>',
                "insert_after": "cloud_files_section",
            },
        ],
        "Supplier": [
            {
                "fieldname": "cloud_files_section",
                "fieldtype": "Section Break",
                "label": "Documents",
                "collapsible": 1,
                "insert_after": "represents_company",
            },
            {
                "fieldname": "cloud_files_html",
                "fieldtype": "HTML",
                "options": '<div id="cloud-files-container"></div>',
                "insert_after": "cloud_files_section",
            },
        ],
    }

    create_custom_fields(custom_fields)


def setup_website_context():
    """Setup website context for public file access"""
    try:
        # Create website context for public file serving
        website_settings = frappe.get_single("Website Settings")

        if not website_settings.get("route_rules"):
            website_settings.route_rules = []

        # Add route rule for cloud file serving
        route_rule = {
            "from_route": "/cloud-files/*",
            "to_route": "/api/method/cloud_file_manager.www.serve_file",
        }

        # Check if rule already exists
        existing = any(
            rule.get("from_route") == route_rule["from_route"]
            for rule in website_settings.route_rules
        )

        if not existing:
            website_settings.append("route_rules", route_rule)
            website_settings.save()

    except Exception as e:
        frappe.log_error(f"Website context setup error: {str(e)}")


def create_notification_templates():
    """Create email notification templates"""

    templates = [
        {
            "name": "Cloud File Upload Notification",
            "subject": "New File Uploaded: {file_name}",
            "message": """
<div style="font-family: Arial, sans-serif; max-width: 600px;">
    <h3>New File Upload Notification</h3>
    <p>A new file has been uploaded to the system:</p>
    
    <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">File Name:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{file_name}</td>
        </tr>
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Uploaded By:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{uploaded_by}</td>
        </tr>
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">File Size:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{file_size}</td>
        </tr>
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">File Type:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{file_type}</td>
        </tr>
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Folder:</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{folder_path}</td>
        </tr>
    </table>
    
    {% if file_url %}
    <p><a href="{file_url}" target="_blank" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View File</a></p>
    {% endif %}
    
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated notification from Cloud File Manager.
    </p>
</div>
            """,
            "doctype": "Email Template",
            "enabled": 1,
        }
    ]

    for template in templates:
        if not frappe.db.exists("Email Template", template["name"]):
            frappe.get_doc(template).insert(ignore_permissions=True)

    frappe.db.commit()


def create_test_settings():
    """Create settings for test environment"""
    if frappe.flags.in_test:
        settings = frappe.get_doc(
            {
                "doctype": "Cloud File Settings",
                "default_folder": "private/files/test",
                "max_file_size": 1048576,  # 1MB for tests
                "allowed_extensions": ".txt,.pdf,.jpg",
                "enable_s3_upload": 0,
                "auto_organize_files": 0,
                "enable_duplicate_check": 1,
                "cache_file_stats": 0,  # Disable caching in tests
                "cleanup_temp_files": 1,
                "temp_file_retention_days": 1,
            }
        )
        settings.insert(ignore_permissions=True)


def create_test_folders():
    """Create test folder structure"""
    if frappe.flags.in_test:
        import os
        from frappe.utils import get_site_path

        test_folders = [
            "private/files/test",
            "private/files/test/images",
            "private/files/test/documents",
        ]

        site_path = get_site_path()
        for folder in test_folders:
            folder_path = os.path.join(site_path, folder)
            os.makedirs(folder_path, mode=0o755, exist_ok=True)


def cleanup_test_data():
    """Clean up test data"""
    if frappe.flags.in_test:
        # Delete test Cloud Files
        test_files = frappe.get_all(
            "Cloud File", filters={"folder_path": ["like", "%test%"]}
        )
        for file_doc in test_files:
            frappe.delete_doc("Cloud File", file_doc.name, ignore_permissions=True)

        # Clean up test folders
        import os
        import shutil
        from frappe.utils import get_site_path

        test_folder = os.path.join(get_site_path(), "private/files/test")
        if os.path.exists(test_folder):
            shutil.rmtree(test_folder)


def migrate_existing_attachments():
    """Migrate existing File documents to Cloud File format"""
    try:
        # Get all File documents that aren't already tracked
        existing_files = frappe.db.sql(
            """
            SELECT f.name, f.file_name, f.file_url, f.file_size, 
                   f.attached_to_doctype, f.attached_to_name, f.is_private,
                   f.creation, f.owner
            FROM `tabFile` f
            LEFT JOIN `tabCloud File` cf ON f.file_url = cf.file_url
            WHERE cf.name IS NULL 
            AND f.file_url IS NOT NULL
            AND f.file_url != ''
            LIMIT 1000
        """,
            as_dict=True,
        )

        migrated_count = 0

        for file_doc in existing_files:
            try:
                # Create corresponding Cloud File record
                cloud_file = frappe.get_doc(
                    {
                        "doctype": "Cloud File",
                        "file_name": file_doc.file_name,
                        "file_url": file_doc.file_url,
                        "file_size": file_doc.file_size,
                        "file_type": os.path.splitext(file_doc.file_name or "")[
                            1
                        ].lower(),
                        "folder_path": "public/files"
                        if not file_doc.is_private
                        else "private/files",
                        "is_public": 0 if file_doc.is_private else 1,
                        "reference_doctype": file_doc.attached_to_doctype,
                        "reference_docname": file_doc.attached_to_name,
                        "uploaded_by": file_doc.owner,
                        "upload_date": file_doc.creation,
                        "description": f"Migrated from File {file_doc.name}",
                        "tags": "migrated",
                    }
                )

                cloud_file.insert(ignore_permissions=True)
                migrated_count += 1

            except Exception as e:
                frappe.log_error(f"Migration error for file {file_doc.name}: {str(e)}")
                continue

        if migrated_count > 0:
            frappe.db.commit()
            frappe.msgprint(
                f"Migrated {migrated_count} existing files to Cloud File format",
                indicator="green",
            )

        return migrated_count

    except Exception as e:
        frappe.log_error(f"File migration error: {str(e)}")
        return 0


def setup_backup_config():
    """Setup backup configuration to exclude file content"""
    try:
        # Add Cloud File to backup exclusions if needed
        backup_settings = frappe.get_single("System Settings")

        exclusions = backup_settings.get("backup_excludes") or ""
        if "Cloud File.file_content" not in exclusions:
            if exclusions:
                exclusions += "\nCloud File.file_content"
            else:
                exclusions = "Cloud File.file_content"

            backup_settings.backup_excludes = exclusions
            backup_settings.save()

    except Exception as e:
        frappe.log_error(f"Backup config error: {str(e)}")


def create_dashboard_charts():
    """Create dashboard charts for file analytics"""

    charts = [
        {
            "name": "Cloud Files by Type",
            "chart_name": "Cloud Files by Type",
            "chart_type": "Pie",
            "doctype_name": "Cloud File",
            "is_public": 1,
            "module": "Cloud File Manager",
            "type": "Report",
            "report_name": "Cloud Files by Type",
            "filters_json": "{}",
            "timeseries": 0,
        },
        {
            "name": "File Upload Trends",
            "chart_name": "File Upload Trends",
            "chart_type": "Line",
            "doctype_name": "Cloud File",
            "is_public": 1,
            "module": "Cloud File Manager",
            "type": "Group By",
            "group_by_type": "Count",
            "group_by_based_on": "creation",
            "time_interval": "Daily",
            "timeseries": 1,
            "filters_json": '{"creation": ["timespan", "last month"]}',
        },
        {
            "name": "Storage Usage by Folder",
            "chart_name": "Storage Usage by Folder",
            "chart_type": "Bar",
            "doctype_name": "Cloud File",
            "is_public": 1,
            "module": "Cloud File Manager",
            "type": "Group By",
            "group_by_type": "Sum",
            "group_by_based_on": "folder_path",
            "aggregate_function_based_on": "file_size",
            "timeseries": 0,
            "filters_json": "{}",
        },
    ]

    for chart_data in charts:
        if not frappe.db.exists("Dashboard Chart", chart_data["name"]):
            chart = frappe.get_doc({"doctype": "Dashboard Chart", **chart_data})
            chart.insert(ignore_permissions=True)

    frappe.db.commit()


def create_workspace():
    """Create Cloud File Manager workspace"""

    if not frappe.db.exists("Workspace", "Cloud File Manager"):
        workspace = frappe.get_doc(
            {
                "doctype": "Workspace",
                "title": "Cloud File Manager",
                "name": "Cloud File Manager",
                "module": "Cloud File Manager",
                "category": "Modules",
                "public": 1,
                "is_standard": 1,
                "icon": "folder",
                "indicator_color": "blue",
                "charts": [
                    {"chart_name": "Cloud Files by Type", "width": "Half"},
                    {"chart_name": "File Upload Trends", "width": "Half"},
                    {"chart_name": "Storage Usage by Folder", "width": "Full"},
                ],
                "shortcuts": [
                    {
                        "type": "DocType",
                        "label": "Cloud File",
                        "doc_type": "Cloud File",
                        "color": "blue",
                    },
                    {
                        "type": "Page",
                        "label": "File Dashboard",
                        "url": "/app/cloud-file-dashboard",
                        "color": "green",
                    },
                    {
                        "type": "Page",
                        "label": "File Uploader",
                        "url": "/app/cloud-file-uploader",
                        "color": "orange",
                    },
                    {
                        "type": "Report",
                        "label": "Files by Type",
                        "doc_type": "Cloud File",
                        "is_query_report": 1,
                        "report_name": "Cloud Files by Type",
                        "color": "purple",
                    },
                ],
                "cards": [{"card_name": "Cloud File", "label": "Cloud Files"}],
            }
        )

        workspace.insert(ignore_permissions=True)
        frappe.db.commit()


def setup_print_formats():
    """Create print formats for Cloud File"""

    if not frappe.db.exists("Print Format", "Cloud File Standard"):
        print_format = frappe.get_doc(
            {
                "doctype": "Print Format",
                "name": "Cloud File Standard",
                "doc_type": "Cloud File",
                "module": "Cloud File Manager",
                "standard": "Yes",
                "custom_format": 1,
                "html": """
<div class="print-format">
    <div class="print-heading">
        <h2>Cloud File Details</h2>
    </div>
    
    <table class="table table-bordered">
        <tr>
            <td style="width: 30%;"><strong>File Name</strong></td>
            <td>{{ doc.file_name }}</td>
        </tr>
        <tr>
            <td><strong>File Type</strong></td>
            <td>{{ doc.file_type }}</td>
        </tr>
        <tr>
            <td><strong>File Size</strong></td>
            <td>{{ doc.file_size | file_size }}</td>
        </tr>
        <tr>
            <td><strong>Folder Path</strong></td>
            <td>{{ doc.folder_path }}</td>
        </tr>
        <tr>
            <td><strong>Uploaded By</strong></td>
            <td>{{ doc.uploaded_by }}</td>
        </tr>
        <tr>
            <td><strong>Upload Date</strong></td>
            <td>{{ frappe.utils.format_datetime(doc.upload_date) }}</td>
        </tr>
        {% if doc.description %}
        <tr>
            <td><strong>Description</strong></td>
            <td>{{ doc.description }}</td>
        </tr>
        {% endif %}
        {% if doc.tags %}
        <tr>
            <td><strong>Tags</strong></td>
            <td>{{ doc.tags }}</td>
        </tr>
        {% endif %}
        {% if doc.reference_doctype and doc.reference_docname %}
        <tr>
            <td><strong>Related Document</strong></td>
            <td>{{ doc.reference_doctype }}: {{ doc.reference_docname }}</td>
        </tr>
        {% endif %}
    </table>
    
    {% if doc.file_url %}
    <div class="mt-4">
        <p><strong>File URL:</strong></p>
        <p><a href="{{ doc.file_url }}" target="_blank">{{ doc.file_url }}</a></p>
    </div>
    {% endif %}
    
    {% if doc.s3_url %}
    <div class="mt-2">
        <p><strong>S3 URL:</strong></p>
        <p><a href="{{ doc.s3_url }}" target="_blank">{{ doc.s3_url }}</a></p>
    </div>
    {% endif %}
</div>
            """,
                "css": """
.print-format {
    font-family: Arial, sans-serif;
    font-size: 12px;
}

.print-heading {
    text-align: center;
    margin-bottom: 30px;
}

.table {
    width: 100%;
    border-collapse: collapse;
}

.table td {
    padding: 8px;
    border: 1px solid #ddd;
    vertical-align: top;
}

.table td:first-child {
    background-color: #f8f9fa;
    font-weight: bold;
}

a {
    color: #007bff;
    text-decoration: none;
}

.mt-4 {
    margin-top: 20px;
}

.mt-2 {
    margin-top: 10px;
}
            """,
            }
        )

        print_format.insert(ignore_permissions=True)
        frappe.db.commit()


def update_existing_installation():
    """Update existing installation with new features"""
    try:
        # Check version and update accordingly
        current_version = frappe.get_value(
            "Module Def", "Cloud File Manager", "app_version"
        )

        # Add new indexes if they don't exist
        create_indexes()

        # Create new settings if they don't exist
        setup_default_settings()

        # Migrate existing data if needed
        migrate_count = migrate_existing_attachments()

        # Create workspace and charts
        create_dashboard_charts()
        create_workspace()

        # Setup print formats
        setup_print_formats()

        frappe.msgprint(
            f"Cloud File Manager updated successfully! Migrated {migrate_count} existing files.",
            indicator="green",
        )

    except Exception as e:
        frappe.log_error(f"Update error: {str(e)}")
        frappe.msgprint(
            "Update completed with some warnings. Check error logs.", indicator="orange"
        )


def validate_installation():
    """Validate that installation was successful"""
    try:
        # Check required doctypes exist
        required_doctypes = ["Cloud File", "Cloud File Settings"]
        for doctype in required_doctypes:
            if not frappe.db.exists("DocType", doctype):
                raise Exception(f"Required DocType {doctype} not found")

        # Check required roles exist
        required_roles = ["File Manager", "File Viewer", "File Uploader"]
        for role in required_roles:
            if not frappe.db.exists("Role", role):
                raise Exception(f"Required Role {role} not found")

        # Check database indexes
        indexes = frappe.db.sql("SHOW INDEX FROM `tabCloud File`", as_dict=True)
        index_names = [idx.get("Key_name") for idx in indexes]

        required_indexes = [
            "idx_cloud_file_type",
            "idx_cloud_file_folder",
            "idx_cloud_file_ref",
        ]
        missing_indexes = [idx for idx in required_indexes if idx not in index_names]

        if missing_indexes:
            frappe.log_error(f"Missing database indexes: {missing_indexes}")

        # Check folder permissions
        import os
        from frappe.utils import get_site_path

        test_folder = os.path.join(get_site_path(), "public/files/products")
        if not os.path.exists(test_folder):
            raise Exception("Default folder structure not created")

        # Test file write permissions
        test_file = os.path.join(test_folder, ".permission_test")
        try:
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
        except Exception:
            raise Exception("Insufficient file system permissions")

        return True

    except Exception as e:
        frappe.log_error(f"Installation validation failed: {str(e)}")
        return False
