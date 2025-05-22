# Copyright (c) 2025, Manot L. and Contributors
# See license.txt

from frappe.tests.utils import FrappeTestCase
import frappe
import unittest
import os
import tempfile
from frappe.utils import get_site_path
from cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file import (
    upload_file_to_products,
)


class TestCloudFile(unittest.TestCase):
    def setUp(self):
        """Set up test environment"""
        self.test_file_content = b"Test file content for Cloud File Manager"
        self.test_filename = "test_file.txt"

    def tearDown(self):
        """Clean up after tests"""
        # Clean up any test files created
        test_files = frappe.get_all(
            "Cloud File", filters={"file_name": ["like", "test_%"]}
        )
        for file in test_files:
            frappe.delete_doc("Cloud File", file.name, ignore_permissions=True)

        frappe.db.commit()

    def test_cloud_file_creation(self):
        """Test basic Cloud File creation"""
        cloud_file = frappe.get_doc(
            {
                "doctype": "Cloud File",
                "file_name": self.test_filename,
                "file_size": len(self.test_file_content),
                "file_type": ".txt",
                "folder_path": "public/files/test",
                "is_public": 1,
                "description": "Test file for unit testing",
            }
        )

        cloud_file.insert()
        self.assertTrue(cloud_file.name)
        self.assertEqual(cloud_file.file_name, self.test_filename)

    def test_file_upload_to_products(self):
        """Test file upload to products folder"""
        result = upload_file_to_products(
            file_content=self.test_file_content,
            filename=self.test_filename,
            folder_path="public/files/test",
            description="Test upload",
        )

        self.assertTrue(result["success"])
        self.assertIn("cloud_file", result)
        self.assertEqual(result["cloud_file"]["file_name"], self.test_filename)

    def test_file_with_reference_document(self):
        """Test Cloud File with reference to another document"""
        # Create a test customer first
        customer = frappe.get_doc(
            {"doctype": "Customer", "customer_name": "Test Customer for Cloud File"}
        )
        customer.insert()

        # Create Cloud File with reference
        cloud_file = frappe.get_doc(
            {
                "doctype": "Cloud File",
                "file_name": "customer_document.pdf",
                "file_size": 1024,
                "file_type": ".pdf",
                "folder_path": "public/files/customers",
                "reference_doctype": "Customer",
                "reference_docname": customer.name,
                "description": "Customer document",
            }
        )

        cloud_file.insert()
        self.assertEqual(cloud_file.reference_doctype, "Customer")
        self.assertEqual(cloud_file.reference_docname, customer.name)

        # Clean up
        frappe.delete_doc("Customer", customer.name)

    def test_file_hash_calculation(self):
        """Test file hash calculation for duplicate detection"""
        import hashlib

        expected_hash = hashlib.sha256(self.test_file_content).hexdigest()

        cloud_file = frappe.get_doc(
            {
                "doctype": "Cloud File",
                "file_name": self.test_filename,
                "file_size": len(self.test_file_content),
                "file_type": ".txt",
                "folder_path": "public/files/test",
                "file_hash": expected_hash,
            }
        )

        cloud_file.insert()
        self.assertEqual(cloud_file.file_hash, expected_hash)

    def test_file_status_transitions(self):
        """Test file status transitions"""
        cloud_file = frappe.get_doc(
            {
                "doctype": "Cloud File",
                "file_name": self.test_filename,
                "file_size": len(self.test_file_content),
                "file_type": ".txt",
                "folder_path": "public/files/test",
                "file_status": "Processing",
            }
        )

        cloud_file.insert()
        self.assertEqual(cloud_file.file_status, "Processing")

        # Update status
        cloud_file.file_status = "Active"
        cloud_file.save()
        self.assertEqual(cloud_file.file_status, "Active")

    def test_public_private_file_handling(self):
        """Test public vs private file handling"""
        # Public file
        public_file = frappe.get_doc(
            {
                "doctype": "Cloud File",
                "file_name": "public_test.txt",
                "folder_path": "public/files/test",
                "is_public": 1,
            }
        )
        public_file.insert()
        self.assertEqual(public_file.is_public, 1)

        # Private file
        private_file = frappe.get_doc(
            {
                "doctype": "Cloud File",
                "file_name": "private_test.txt",
                "folder_path": "private/files/test",
                "is_public": 0,
            }
        )
        private_file.insert()
        self.assertEqual(private_file.is_public, 0)

    def test_file_metadata_json(self):
        """Test JSON metadata storage"""
        metadata = {
            "image_width": 1920,
            "image_height": 1080,
            "camera_model": "Test Camera",
            "location": "Test Location",
        }

        cloud_file = frappe.get_doc(
            {
                "doctype": "Cloud File",
                "file_name": "image_with_metadata.jpg",
                "file_type": ".jpg",
                "folder_path": "public/files/images",
                "metadata": frappe.as_json(metadata),
            }
        )

        cloud_file.insert()
        stored_metadata = frappe.parse_json(cloud_file.metadata)
        self.assertEqual(stored_metadata["image_width"], 1920)
        self.assertEqual(stored_metadata["camera_model"], "Test Camera")

    def test_file_search_functionality(self):
        """Test file search by tags and description"""
        cloud_file = frappe.get_doc(
            {
                "doctype": "Cloud File",
                "file_name": "searchable_file.txt",
                "file_type": ".txt",
                "folder_path": "public/files/test",
                "tags": "test, searchable, document",
                "description": "This is a test file for search functionality",
            }
        )

        cloud_file.insert()

        # Search by tags
        results = frappe.get_all(
            "Cloud File",
            filters={"tags": ["like", "%searchable%"]},
            fields=["name", "file_name"],
        )

        self.assertTrue(len(results) > 0)
        self.assertEqual(results[0]["file_name"], "searchable_file.txt")
