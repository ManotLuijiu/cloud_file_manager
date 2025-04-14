import frappe


@frappe.whitelist()
def get_dashboard_data():
    """Get data for the Cloud File dashboard"""

    # Get file type distribution
    file_types = frappe.db.sql(
        """
        SELECT file_type, COUNT(*) as count 
        FROM `tabCloud File` 
        GROUP BY file_type
    """,
        as_dict=True,
    )

    # Get recent files
    recent_files = frappe.get_all(
        "Cloud File",
        fields=["file_url", "file_type", "ref_doctype", "ref_docname"],
        order_by="creation desc",
        limit=5,
    )

    return {"file_types": file_types, "recent_files": recent_files}
