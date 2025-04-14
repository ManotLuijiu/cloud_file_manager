# Copyright (c) 2025, Manot L. and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
    if not filters:
        filters = {}

    columns = get_columns()
    data = get_data(filters)

    return columns, data


def get_columns():
    return [
        {
            "fieldname": "file_type",
            "label": _("File Type"),
            "fieldtype": "Data",
            "width": 150,
        },
        {"fieldname": "count", "label": _("Count"), "fieldtype": "Int", "width": 100},
        {
            "fieldname": "avg_url_length",
            "label": _("Avg URL Length"),
            "fieldtype": "Float",
            "precision": 2,
            "width": 150,
        },
    ]


def get_data(filters):
    conditions = ""
    if filters.get("file_type"):
        conditions += f" AND file_type = '{filters.get('file_type')}'"

    # Get counts and average URL length by file type
    data = frappe.db.sql(
        f"""
        SELECT 
            file_type,
            COUNT(*) as count,
            AVG(LENGTH(file_url)) as avg_url_length
        FROM `tabCloud File`
        WHERE 1=1 {conditions}
        GROUP BY file_type
    """,
        as_dict=True,
    )

    # Handle NULL file_type
    for row in data:
        if not row.file_type:  # type: ignore
            row.file_type = "Not Specified"  # type: ignore

    return data
