// Copyright (c) 2025, Manot L. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Cloud File", {
  refresh: function (frm) {
    // Add a button to test the URL
    if (frm.doc.file_url) {
      frm.add_custom_button(__("Test URL"), function () {
        window.open(frm.doc.file_url, "_blank");
      });
    }

    // Add a button to upload a file (this would typically integrate with your cloud provider)
    frm.add_custom_button(__("Upload File"), function () {
      // Show a dialog for file upload
      const dialog = new frappe.ui.Dialog({
        title: __("Upload File to Cloud"),
        fields: [
          {
            label: __("File"),
            fieldname: "file",
            fieldtype: "Attach",
          },
          {
            label: __("Cloud Provider"),
            fieldname: "file_type",
            fieldtype: "Select",
            options: "S3\nGoogle Cloud\nLocal\nOther",
            default: frm.doc.file_type || "S3",
          },
        ],
        primary_action_label: __("Upload"),
        primary_action: function () {
          const values = dialog.get_values();

          if (!values.file) {
            frappe.throw(__("Please select a file to upload"));
            return;
          }

          // In a real app, you would call a method to upload to the cloud
          frappe.show_alert({
            message: __("Uploading file to {0}...", [values.file_type]),
            indicator: "blue",
          });

          // Simulate cloud upload
          setTimeout(() => {
            // Set values in the form
            frm.set_value("file_url", values.file);
            frm.set_value("file_type", values.file_type);

            frappe.show_alert({
              message: __("File uploaded successfully"),
              indicator: "green",
            });

            dialog.hide();
          }, 2000);
        },
      });

      dialog.show();
    });
  },
});
