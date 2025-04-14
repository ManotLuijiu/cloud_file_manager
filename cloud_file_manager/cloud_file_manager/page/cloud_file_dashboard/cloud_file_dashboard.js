frappe.pages["cloud-file-dashboard"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Cloud File Dashboard"),
		single_column: true,
	});
};

frappe.pages["cloud-file-dashboard"].on_page_show = function (wrapper) {
	load_desk_page(wrapper);
};

function load_desk_page(wrapper) {
	let $parent = $(wrapper).find(".layout-main-section");
	$parent.empty();

	frappe.require("cloud_file_dashboard.bundle.jsx").then(() => {
		frappe.cloud_file_dashboard = new frappe.ui.CloudFileDashboard({
			wrapper: $parent,
			page: wrapper.page,
		});
	});
}