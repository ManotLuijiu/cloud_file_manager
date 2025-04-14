import frappe
from frappe import _
from frappe.utils import cint


@frappe.whitelist()
def get_cloud_files(doctype=None, docname=None, limit=20, offset=0):
    """Get Cloud Files, optionally filtered by reference doctype and docname"""

    limit = cint(limit)
    offset = cint(offset)

    filters = {}
    if doctype:
        filters["ref_doctype"] = doctype
    if docname:
        filters["ref_docname"] = docname

    files = frappe.get_all(
        "Cloud File",
        filters=filters,
        fields=["name", "file_url", "file_type", "ref_doctype", "ref_docname"],
        limit_start=offset,
        limit=limit,
        order_by="creation desc",
    )

    return {"files": files, "total": frappe.db.count("Cloud File", filters)}


@frappe.whitelist()
def create_cloud_file(file_url, file_type=None, ref_doctype=None, ref_docname=None):
    """Create a new Cloud File record"""

    if not file_url:
        frappe.throw(_("File URL is required"))

    doc = frappe.get_doc(
        {
            "doctype": "Cloud File",
            "file_url": file_url,
            "file_type": file_type,
            "ref_doctype": ref_doctype,
            "ref_docname": ref_docname,
        }
    )

    doc.insert()

    return {
        "success": True,
        "file": {
            "name": doc.name,
            "file_url": doc.file_url,  # type: ignore
            "file_type": doc.file_type,  # type: ignore
            "ref_doctype": doc.ref_doctype,  # type: ignore
            "ref_docname": doc.ref_docname,  # type: ignore
        },
    }
