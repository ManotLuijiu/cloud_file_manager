// Copyright (c) 2025, Manot L. and contributors
// For license information, please see license.txt

frappe.query_reports["Cloud Files by Type"] = {
  filters: [
    {
      fieldname: "file_type",
      label: __("File Type"),
      fieldtype: "Select",
      options: "\nS3\nGoogle Cloud\nLocal\nOther",
      default: "",
    },
  ],
};
