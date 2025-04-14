# Initialize the commands module
import click
import frappe
from frappe.commands import pass_context
from .create_cloud_file_doctype import create_cloud_file_doctype

@click.command('create-cloud-file-doctype')
@pass_context
def create_doctype(context):
    """Create the Cloud File DocType"""
    with frappe.init_site(context.sites[0]):
        frappe.connect()
        create_cloud_file_doctype()
        frappe.db.commit()

commands = [
    create_doctype
]