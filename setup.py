from setuptools import setup, find_packages

# get version from __version__ variable in cloud_file_manager/__init__.py
from cloud_file_manager import __version__ as version

setup(
    name="cloud_file_manager",
    version=version,
    description="Stores file metadata (S3 URLs, etc.), can be related to any document in any app",
    author="Manot L.",
    author_email="moocoding@gmail.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    # Dependencies are now managed in pyproject.toml
    entry_points={
        "frappe.commands": [
            "cloud_file_manager=cloud_file_manager.commands.cloud_file:commands"
        ],
    },
)
