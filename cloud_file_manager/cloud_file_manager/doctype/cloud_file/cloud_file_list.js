frappe.listview_settings["Cloud File"] = {
  hide_name_column: true,

  onload: function (listview) {
    // Add custom button
    listview.page.add_inner_button(__("Upload to Cloud"), function () {
      frappe.route_options = {};
      frappe.set_route("Form", "Cloud File", "new-cloud-file");
    });
  },

  get_indicator: function (doc) {
    // Use different colors based on file type
    if (doc.file_type === "S3") {
      return [__("S3"), "blue", "file_type,=,S3"];
    } else if (doc.file_type === "Google Cloud") {
      return [__("Google Cloud"), "green", "file_type,=,Google Cloud"];
    } else if (doc.file_type === "Local") {
      return [__("Local"), "orange", "file_type,=,Local"];
    } else {
      return [__("Other"), "gray", "file_type,=,Other"];
    }
  },

  formatters: {
    file_url: function (value) {
      return `<a href="${value}" target="_blank">${value}</a>`;
    },
  },
};
