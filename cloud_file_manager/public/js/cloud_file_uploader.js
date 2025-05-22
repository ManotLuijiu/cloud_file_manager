class CloudFileUploader {
    constructor(options = {}) {
        this.options = {
            folder_path: 'public/files/products',
            allowed_file_types: ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'],
            max_file_size: 10 * 1024 * 1024, // 10MB
            multiple: true,
            reference_doctype: null,
            reference_docname: null,
            ...options
        };
        
        this.setup_uploader();
    }
    
    setup_uploader() {
        // Create upload dialog
        this.dialog = new frappe.ui.Dialog({
            title: __('Upload Files to Products Folder'),
            fields: [
                {
                    label: __('Folder Path'),
                    fieldname: 'folder_path',
                    fieldtype: 'Data',
                    default: this.options.folder_path,
                    reqd: 1
                },
                {
                    label: __('Reference Document Type'),
                    fieldname: 'reference_doctype',
                    fieldtype: 'Link',
                    options: 'DocType',
                    default: this.options.reference_doctype
                },
                {
                    label: __('Reference Document'),
                    fieldname: 'reference_docname',
                    fieldtype: 'Dynamic Link',
                    options: 'reference_doctype',
                    default: this.options.reference_docname
                },
                {
                    label: __('Description'),
                    fieldname: 'description',
                    fieldtype: 'Text'
                },
                {
                    label: __('Tags'),
                    fieldname: 'tags',
                    fieldtype: 'Data',
                    description: __('Comma-separated tags')
                },
                {
                    label: __('Files'),
                    fieldname: 'file_upload_area',
                    fieldtype: 'HTML',
                    options: '<div id="cloud-file-upload-area" style="border: 2px dashed #ccc; padding: 20px; text-align: center; margin: 10px 0;"><p>Drag and drop files here or click to browse</p></div>'
                }
            ],
            primary_action_label: __('Upload'),
            primary_action: () => this.upload_files(),
            secondary_action_label: __('Cancel')
        });
        
        this.dialog.show();
        this.setup_file_drop_area();
    }
    
    setup_file_drop_area() {
        const upload_area = this.dialog.$wrapper.find('#cloud-file-upload-area');
        const file_input = $('<input type="file" multiple style="display: none;">');
        
        // Add file input to dialog
        this.dialog.$wrapper.append(file_input);
        
        // Configure file input
        file_input.attr('accept', this.options.allowed_file_types.join(','));
        
        // Click to browse
        upload_area.on('click', () => {
            file_input.click();
        });
        
        // File selection handler
        file_input.on('change', (e) => {
            this.handle_file_selection(e.target.files);
        });
        
        // Drag and drop handlers
        upload_area.on('dragover', (e) => {
            e.preventDefault();
            upload_area.addClass('drag-over');
        });
        
        upload_area.on('dragleave', (e) => {
            e.preventDefault();
            upload_area.removeClass('drag-over');
        });
        
        upload_area.on('drop', (e) => {
            e.preventDefault();
            upload_area.removeClass('drag-over');
            this.handle_file_selection(e.originalEvent.dataTransfer.files);
        });
        
        this.selected_files = [];
    }
    
    handle_file_selection(files) {
        const upload_area = this.dialog.$wrapper.find('#cloud-file-upload-area');
        let file_list_html = '<div class="selected-files"><h5>Selected Files:</h5>';
        
        this.selected_files = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Validate file
            const validation_result = this.validate_file(file);
            if (validation_result.valid) {
                this.selected_files.push(file);
                file_list_html += `
                    <div class="file-item" style="display: flex; justify-content: space-between; padding: 5px; border-bottom: 1px solid #eee;">
                        <span><i class="fa fa-file"></i> ${file.name} (${this.format_file_size(file.size)})</span>
                        <span class="text-success"><i class="fa fa-check"></i></span>
                    </div>
                `;
            } else {
                file_list_html += `
                    <div class="file-item" style="display: flex; justify-content: space-between; padding: 5px; border-bottom: 1px solid #eee;">
                        <span><i class="fa fa-file"></i> ${file.name}</span>
                        <span class="text-danger" title="${validation_result.error}"><i class="fa fa-times"></i></span>
                    </div>
                `;
            }
        }
        
        file_list_html += '</div>';
        upload_area.html(file_list_html);
    }
    
    validate_file(file) {
        // Check file size
        if (file.size > this.options.max_file_size) {
            return {
                valid: false,
                error: `File size exceeds ${this.format_file_size(this.options.max_file_size)} limit`
            };
        }
        
        // Check file type
        const file_extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!this.options.allowed_file_types.includes(file_extension)) {
            return {
                valid: false,
                error: `File type ${file_extension} not allowed`
            };
        }
        
        return { valid: true };
    }
    
    format_file_size(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async upload_files() {
        if (this.selected_files.length === 0) {
            frappe.msgprint(__('Please select files to upload'));
            return;
        }
        
        const values = this.dialog.get_values();
        const progress_dialog = this.show_progress_dialog();
        
        try {
            // Prepare files data
            const files_data = [];
            
            for (let file of this.selected_files) {
                const file_content = await this.read_file_as_base64(file);
                files_data.push({
                    filename: file.name,
                    content: file_content,
                    folder_path: values.folder_path,
                    reference_doctype: values.reference_doctype,
                    reference_docname: values.reference_docname,
                    description: values.description,
                    tags: values.tags
                });
            }
            
            // Upload files
            const response = await frappe.call({
                method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.upload_multiple_files',
                args: {
                    files_data: files_data
                }
            });
            
            progress_dialog.hide();
            this.dialog.hide();
            
            if (response.message.success) {
                const results = response.message;
                frappe.msgprint({
                    title: __('Upload Complete'),
                    message: __(`Successfully uploaded ${results.successful_uploads} out of ${results.total_files} files`),
                    indicator: 'green'
                });
                
                // Trigger callback if provided
                if (this.options.on_success) {
                    this.options.on_success(results);
                }
                
                // Refresh if we're on a document form
                if (cur_frm && values.reference_doctype === cur_frm.doctype && values.reference_docname === cur_frm.docname) {
                    cur_frm.reload_doc();
                }
            } else {
                frappe.msgprint({
                    title: __('Upload Failed'),
                    message: response.message.error || __('Unknown error occurred'),
                    indicator: 'red'
                });
            }
            
        } catch (error) {
            progress_dialog.hide();
            frappe.msgprint({
                title: __('Upload Error'),
                message: error.message || __('An error occurred during upload'),
                indicator: 'red'
            });
        }
    }
    
    read_file_as_base64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove data URL prefix to get base64 content
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    show_progress_dialog() {
        const progress_dialog = new frappe.ui.Dialog({
            title: __('Uploading Files'),
            fields: [
                {
                    fieldtype: 'HTML',
                    options: `
                        <div class="progress" style="margin: 20px 0;">
                            <div class="progress-bar progress-bar-striped progress-bar-animated" 
                                 role="progressbar" style="width: 100%"></div>
                        </div>
                        <p class="text-center">Please wait while files are being uploaded...</p>
                    `
                }
            ]
        });
        
        progress_dialog.show();
        return progress_dialog;
    }
}

// Cloud File List Component
class CloudFileList {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            reference_doctype: null,
            reference_docname: null,
            editable: true,
            ...options
        };
        
        this.render();
        this.load_files();
    }
    
    render() {
        const html = `
            <div class="cloud-file-list">
                <div class="cloud-file-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h5>Cloud Files</h5>
                    ${this.options.editable ? '<button class="btn btn-primary btn-sm" id="add-cloud-files">Add Files</button>' : ''}
                </div>
                <div class="cloud-file-items" id="cloud-file-items">
                    <div class="text-center text-muted">Loading files...</div>
                </div>
            </div>
        `;
        
        $(this.container).html(html);
        
        // Add files button handler
        if (this.options.editable) {
            $(this.container).find('#add-cloud-files').on('click', () => {
                new CloudFileUploader({
                    reference_doctype: this.options.reference_doctype,
                    reference_docname: this.options.reference_docname,
                    on_success: () => this.load_files()
                });
            });
        }
    }
    
    async load_files() {
        try {
            const response = await frappe.call({
                method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.get_files_by_reference',
                args: {
                    reference_doctype: this.options.reference_doctype,
                    reference_docname: this.options.reference_docname
                }
            });
            
            this.render_files(response.message || []);
            
        } catch (error) {
            $(this.container).find('#cloud-file-items').html('<div class="text-center text-danger">Error loading files</div>');
        }
    }
    
    render_files(files) {
        const items_container = $(this.container).find('#cloud-file-items');
        
        if (files.length === 0) {
            items_container.html('<div class="text-center text-muted">No files found</div>');
            return;
        }
        
        let html = '';
        files.forEach(file => {
            html += `
                <div class="cloud-file-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid #eee; margin-bottom: 5px; border-radius: 4px;">
                    <div class="file-info" style="flex-grow: 1;">
                        <div class="file-name" style="font-weight: bold;">
                            <i class="fa fa-file"></i> ${file.file_name}
                        </div>
                        <div class="file-details" style="font-size: 12px; color: #666;">
                            Size: ${this.format_file_size(file.file_size)} | 
                            Type: ${file.file_type} | 
                            Uploaded: ${frappe.datetime.str_to_user(file.upload_date)}
                            ${file.description ? `<br>Description: ${file.description}` : ''}
                            ${file.tags ? `<br>Tags: ${file.tags}` : ''}
                        </div>
                    </div>
                    <div class="file-actions">
                        <a href="${file.file_url}" target="_blank" class="btn btn-sm btn-default" title="View">
                            <i class="fa fa-eye"></i>
                        </a>
                        ${file.s3_url ? `<a href="${file.s3_url}" target="_blank" class="btn btn-sm btn-default" title="View S3"><i class="fa fa-cloud"></i></a>` : ''}
                        ${this.options.editable ? `<button class="btn btn-sm btn-danger" onclick="cloud_file_list.delete_file('${file.name}')" title="Delete"><i class="fa fa-trash"></i></button>` : ''}
                    </div>
                </div>
            `;
        });
        
        items_container.html(html);
    }
    
    format_file_size(bytes) {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async delete_file(file_name) {
        const confirm_delete = await new Promise(resolve => {
            frappe.confirm(
                __('Are you sure you want to delete this file?'),
                () => resolve(true),
                () => resolve(false)
            );
        });
        
        if (!confirm_delete) return;
        
        try {
            const response = await frappe.call({
                method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.delete_cloud_file',
                args: {
                    cloud_file_name: file_name
                }
            });
            
            if (response.message.success) {
                frappe.show_alert({
                    message: __('File deleted successfully'),
                    indicator: 'green'
                });
                this.load_files(); // Reload the file list
            } else {
                frappe.msgprint({
                    title: __('Deletion Failed'),
                    message: response.message.error || __('Unknown error occurred'),
                    indicator: 'red'
                });
            }
        } catch (error) {
            frappe.msgprint({
                title: __('Error'),
                message: error.message || __('An error occurred while deleting the file'),
                indicator: 'red'
            });
        }
    }
}

// Global function to make CloudFileList accessible
window.cloud_file_list = null;

// Form Script Integration
frappe.ui.form.on('*', {
    refresh: function(frm) {
        // Add Cloud Files section to any form that needs it
        if (frm.doctype && frm.docname && frm.fields_dict.cloud_files_section) {
            const container = frm.fields_dict.cloud_files_section.$wrapper;
            window.cloud_file_list = new CloudFileList(container, {
                reference_doctype: frm.doctype,
                reference_docname: frm.docname,
                editable: frm.doc.__islocal ? false : true
            });
        }
    }
});

// Quick Upload Function for Programmatic Use
window.quick_upload_to_products = function(files, options = {}) {
    const uploader = new CloudFileUploader({
        folder_path: 'public/files/products',
        ...options
    });
    
    if (files && files.length > 0) {
        uploader.handle_file_selection(files);
    }
};

// Utility Functions
window.CloudFileUtils = {
    
    // Upload single file programmatically
    async uploadFile(file_content, filename, options = {}) {
        const response = await frappe.call({
            method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.upload_file_to_products',
            args: {
                file_content: file_content,
                filename: filename,
                folder_path: options.folder_path || 'public/files/products',
                reference_doctype: options.reference_doctype,
                reference_docname: options.reference_docname,
                description: options.description,
                tags: options.tags
            }
        });
        
        return response.message;
    },
    
    // Get files for a document
    async getFiles(reference_doctype, reference_docname) {
        const response = await frappe.call({
            method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.get_files_by_reference',
            args: {
                reference_doctype: reference_doctype,
                reference_docname: reference_docname
            }
        });
        
        return response.message || [];
    },
    
    // Delete file
    async deleteFile(cloud_file_name) {
        const response = await frappe.call({
            method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.delete_cloud_file',
            args: {
                cloud_file_name: cloud_file_name
            }
        });
        
        return response.message;
    },
    
    // Show file uploader dialog
    showUploader(options = {}) {
        return new CloudFileUploader(options);
    }
};