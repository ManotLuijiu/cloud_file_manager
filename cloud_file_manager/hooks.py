app_name = "cloud_file_manager"
app_title = "Cloud File Manager"
app_publisher = "Manot L."
app_description = "Stores file metadata (S3 URLs, etc.), can be related to any document in any app, is not deleted on app uninstall (use together with dfp_external_storage)"
app_email = "moocoding@gmail.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "cloud_file_manager",
# 		"logo": "/assets/cloud_file_manager/logo.png",
# 		"title": "Cloud File Manager",
# 		"route": "/cloud_file_manager",
# 		"has_permission": "cloud_file_manager.api.permission.has_app_permission"
# 	}
# ]

website_route_rules = [
    {"from_route": "/vue-fundamentals/<path:app_path>", "to_route": "vue-fundamentals"},
]
