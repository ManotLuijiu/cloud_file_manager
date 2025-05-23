class CloudFileUploader {
    constructor(options = {}) {
        this.options = {
            folder_path: 'public/files/products',
            allowed_file_types: ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.txt'],
            max_file_size: 10 * 1024 * 1024, // 10MB
            multiple: true,
            reference_doctype: null,
            reference_docname: null,
            chunk_size: 1024 * 1024, // 1MB chunks for large files
            max_concurrent_uploads: 3,
            retry_attempts: 3,
            ...options
        };
        
        // Resource management
        this.activeReaders = new Set();
        this.activeUploads = new Map();
        this.abortControllers = new Set();
        this.uploadQueue = [];
        this.currentUploads = 0;
        
        // Security and validation
        this.validator = new FileValidator(this.options);
        
        this.setup_uploader();
    }
    
    setup_uploader() {
        // Create enhanced upload dialog with better UX
        this.dialog = new frappe.ui.Dialog({
            title: __('Upload Files to Cloud Storage'),
            size: 'large',
            fields: [
                {
                    fieldtype: 'Section Break',
                    label: __('Upload Configuration')
                },
                {
                    label: __('Folder Path'),
                    fieldname: 'folder_path',
                    fieldtype: 'Data',
                    default: this.options.folder_path,
                    reqd: 1,
                    description: __('Target folder for uploaded files')
                },
                {
                    label: __('Reference Document Type'),
                    fieldname: 'reference_doctype',
                    fieldtype: 'Link',
                    options: 'DocType',
                    default: this.options.reference_doctype,
                    change: () => {
                        // Clear reference docname when doctype changes
                        this.dialog.set_value('reference_docname', '');
                    }
                },
                {
                    label: __('Reference Document'),
                    fieldname: 'reference_docname',
                    fieldtype: 'Dynamic Link',
                    options: 'reference_doctype',
                    default: this.options.reference_docname
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: __('Description'),
                    fieldname: 'description',
                    fieldtype: 'Text',
                    description: __('Optional description for uploaded files')
                },
                {
                    label: __('Tags'),
                    fieldname: 'tags',
                    fieldtype: 'Data',
                    description: __('Comma-separated tags for better organization')
                },
                {
                    label: __('Make Files Public'),
                    fieldname: 'is_public',
                    fieldtype: 'Check',
                    default: this.options.folder_path.startsWith('public') ? 1 : 0,
                    description: __('Allow public access to uploaded files')
                },
                {
                    fieldtype: 'Section Break',
                    label: __('File Selection')
                },
                {
                    label: __('Files'),
                    fieldname: 'file_upload_area',
                    fieldtype: 'HTML',
                    options: this.get_upload_area_html()
                },
                {
                    fieldtype: 'Section Break',
                    label: __('Upload Progress'),
                    depends_on: 'eval:false' // Hidden by default
                },
                {
                    fieldname: 'progress_area',
                    fieldtype: 'HTML',
                    options: '<div id="upload-progress-container"></div>'
                }
            ],
            primary_action_label: __('Upload Files'),
            primary_action: () => this.start_upload(),
            secondary_action_label: __('Cancel'),
            secondary_action: () => this.cleanup_and_close()
        });
        
        this.dialog.show();
        this.setup_file_drop_area();
        this.setup_keyboard_shortcuts();
    }
    
    get_upload_area_html() {
        return `
            <div id="cloud-file-upload-area" class="upload-drop-zone">
                <div class="upload-zone-content">
                    <div class="upload-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                    </div>
                    <h4>${__('Drop files here or click to browse')}</h4>
                    <p class="text-muted">
                        ${__('Supported formats')}: ${this.options.allowed_file_types.join(', ')}<br>
                        ${__('Maximum file size')}: ${this.format_file_size(this.options.max_file_size)}
                    </p>
                    <button type="button" class="btn btn-primary btn-sm" id="browse-files-btn">
                        <i class="fa fa-plus"></i> ${__('Select Files')}
                    </button>
                </div>
                <div id="selected-files-preview" class="selected-files-preview"></div>
            </div>
            
            <style>
                .upload-drop-zone {
                    border: 2px dashed #d1d5db;
                    border-radius: 8px;
                    padding: 2rem;
                    text-align: center;
                    background: #f9fafb;
                    transition: all 0.3s ease;
                    min-height: 200px;
                }
                
                .upload-drop-zone.drag-over {
                    border-color: #3b82f6;
                    background: #eff6ff;
                    transform: scale(1.02);
                }
                
                .upload-drop-zone.has-files {
                    text-align: left;
                }
                
                .upload-zone-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }
                
                .upload-icon {
                    color: #6b7280;
                }
                
                .selected-files-preview {
                    margin-top: 1rem;
                    display: none;
                }
                
                .file-preview-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.75rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    margin-bottom: 0.5rem;
                    background: white;
                }
                
                .file-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                
                .file-icon {
                    width: 24px;
                    height: 24px;
                    color: #6b7280;
                }
                
                .file-details h6 {
                    margin: 0;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                
                .file-details small {
                    color: #6b7280;
                    font-size: 0.75rem;
                }
                
                .file-actions {
                    display: flex;
                    gap: 0.5rem;
                }
                
                .file-status {
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 500;
                }
                
                .file-status.valid {
                    background: #dcfce7;
                    color: #166534;
                }
                
                .file-status.invalid {
                    background: #fee2e2;
                    color: #dc2626;
                }
                
                .progress-bar {
                    width: 100%;
                    height: 4px;
                    background: #e5e7eb;
                    border-radius: 2px;
                    overflow: hidden;
                    margin-top: 0.5rem;
                }
                
                .progress-fill {
                    height: 100%;
                    background: #3b82f6;
                    transition: width 0.3s ease;
                }
            </style>
        `;
    }
    
    setup_file_drop_area() {
        const upload_area = this.dialog.$wrapper.find('#cloud-file-upload-area');
        const file_input = $('<input type="file" multiple style="display: none;" accept="' + this.options.allowed_file_types.join(',') + '">');
        
        // Add file input to dialog
        this.dialog.$wrapper.append(file_input);
        
        // Browse button click
        upload_area.on('click', '#browse-files-btn', (e) => {
            e.stopPropagation();
            file_input.click();
        });
        
        // File selection handler
        file_input.on('change', (e) => {
            this.handle_file_selection(Array.from(e.target.files));
        });
        
        // Enhanced drag and drop handlers
        upload_area.on('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            upload_area.addClass('drag-over');
        });
        
        upload_area.on('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only remove drag-over if we're leaving the upload area entirely
            if (!upload_area[0].contains(e.relatedTarget)) {
                upload_area.removeClass('drag-over');
            }
        });
        
        upload_area.on('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            upload_area.removeClass('drag-over');
            
            const files = Array.from(e.originalEvent.dataTransfer.files);
            this.handle_file_selection(files);
        });
        
        // Click to browse when clicking empty area
        upload_area.on('click', (e) => {
            if (e.target === upload_area[0] || $(e.target).hasClass('upload-zone-content')) {
                file_input.click();
            }
        });
        
        this.selected_files = new Map();
    }
    
    setup_keyboard_shortcuts() {
        // ESC to close dialog
        $(document).on('keydown.cloud_file_uploader', (e) => {
            if (e.key === 'Escape' && this.dialog && this.dialog.display) {
                this.cleanup_and_close();
            }
        });
    }
    
    handle_file_selection(files) {
        const upload_area = this.dialog.$wrapper.find('#cloud-file-upload-area');
        const preview_container = upload_area.find('#selected-files-preview');
        
        // Validate and add files
        for (const file of files) {
            const fileId = this.generate_file_id(file);
            
            if (this.selected_files.has(fileId)) {
                continue; // Skip duplicates
            }
            
            const validation = this.validator.validate_file(file);
            this.selected_files.set(fileId, {
                file: file,
                id: fileId,
                valid: validation.valid,
                error: validation.error,
                status: 'pending'
            });
        }
        
        this.render_file_preview();
        this.update_dialog_state();
    }
    
    generate_file_id(file) {
        return `${file.name}_${file.size}_${file.lastModified}`;
    }
    
    render_file_preview() {
        const upload_area = this.dialog.$wrapper.find('#cloud-file-upload-area');
        const preview_container = upload_area.find('#selected-files-preview');
        
        if (this.selected_files.size === 0) {
            preview_container.hide();
            upload_area.removeClass('has-files');
            return;
        }
        
        upload_area.addClass('has-files');
        preview_container.show();
        
        let html = '<h5>' + __('Selected Files') + '</h5>';
        
        for (const [fileId, fileData] of this.selected_files) {
            const { file, valid, error, status } = fileData;
            
            html += `
                <div class="file-preview-item" data-file-id="${fileId}">
                    <div class="file-info">
                        <div class="file-icon">
                            ${this.get_file_icon(file.name)}
                        </div>
                        <div class="file-details">
                            <h6>${this.escape_html(file.name)}</h6>
                            <small>${this.format_file_size(file.size)} • ${this.get_file_type(file.name)}</small>
                            ${status === 'uploading' ? '<div class="progress-bar"><div class="progress-fill" style="width: 0%"></div></div>' : ''}
                        </div>
                    </div>
                    <div class="file-actions">
                        <span class="file-status ${valid ? 'valid' : 'invalid'}">
                            ${valid ? '<i class="fa fa-check"></i> ' + __('Valid') : '<i class="fa fa-times"></i> ' + (error || __('Invalid'))}
                        </span>
                        ${status !== 'uploading' ? `<button type="button" class="btn btn-xs btn-danger remove-file-btn" data-file-id="${fileId}"><i class="fa fa-times"></i></button>` : ''}
                    </div>
                </div>
            `;
        }
        
        preview_container.html(html);
        
        // Add remove file handlers
        preview_container.off('click', '.remove-file-btn').on('click', '.remove-file-btn', (e) => {
            const fileId = $(e.target).closest('.remove-file-btn').data('file-id');
            this.remove_file(fileId);
        });
    }
    
    remove_file(fileId) {
        this.selected_files.delete(fileId);
        this.render_file_preview();
        this.update_dialog_state();
    }
    
    update_dialog_state() {
        const valid_files = Array.from(this.selected_files.values()).filter(f => f.valid);
        const primary_btn = this.dialog.get_primary_btn();
        
        if (valid_files.length === 0) {
            primary_btn.prop('disabled', true);
            primary_btn.text(__('No Valid Files Selected'));
        } else {
            primary_btn.prop('disabled', false);
            primary_btn.text(__('Upload {0} Files', [valid_files.length]));
        }
    }
    
    async start_upload() {
        const valid_files = Array.from(this.selected_files.values()).filter(f => f.valid);
        
        if (valid_files.length === 0) {
            frappe.msgprint(__('Please select valid files to upload'));
            return;
        }
        
        const values = this.dialog.get_values();
        if (!values.folder_path) {
            frappe.msgprint(__('Please specify a folder path'));
            return;
        }
        
        // Show progress section
        this.dialog.fields_dict.progress_area.df.depends_on = 'eval:true';
        this.dialog.refresh();
        
        // Disable dialog controls during upload
        this.dialog.get_primary_btn().prop('disabled', true);
        this.dialog.get_close_btn().prop('disabled', true);
        
        try {
            await this.process_upload_queue(valid_files, values);
        } catch (error) {
            console.error('Upload process error:', error);
            frappe.msgprint({
                title: __('Upload Error'),
                message: error.message || __('An error occurred during upload'),
                indicator: 'red'
            });
        } finally {
            // Re-enable dialog controls
            this.dialog.get_primary_btn().prop('disabled', false);
            this.dialog.get_close_btn().prop('disabled', false);
        }
    }
    
    async process_upload_queue(files, config) {
        this.upload_results = {
            total: files.length,
            successful: 0,
            failed: 0,
            errors: []
        };
        
        // Reset queue
        this.uploadQueue = [...files];
        this.currentUploads = 0;
        
        // Start initial uploads
        const initial_uploads = Math.min(this.options.max_concurrent_uploads, this.uploadQueue.length);
        const upload_promises = [];
        
        for (let i = 0; i < initial_uploads; i++) {
            upload_promises.push(this.process_next_upload(config));
        }
        
        // Wait for all uploads to complete
        await Promise.allSettled(upload_promises);
        
        // Show results
        this.show_upload_results();
    }
    
    async process_next_upload(config) {
        while (this.uploadQueue.length > 0) {
            const fileData = this.uploadQueue.shift();
            if (!fileData) break;
            
            this.currentUploads++;
            
            try {
                await this.upload_single_file(fileData, config);
                this.upload_results.successful++;
            } catch (error) {
                this.upload_results.failed++;
                this.upload_results.errors.push({
                    filename: fileData.file.name,
                    error: error.message
                });
                console.error(`Upload failed for ${fileData.file.name}:`, error);
            } finally {
                this.currentUploads--;
            }
        }
    }
    
    async upload_single_file(fileData, config) {
        const { file, id } = fileData;
        
        // Update file status
        this.selected_files.set(id, { ...fileData, status: 'uploading' });
        this.update_file_progress(id, 0, 'reading');
        
        try {
            // Read file content
            const fileContent = await this.read_file_safely(file);
            this.update_file_progress(id, 30, 'uploading');
            
            // Create abort controller for this upload
            const abortController = new AbortController();
            this.abortControllers.add(abortController);
            
            // Upload with retry logic
            const result = await this.upload_with_retry(
                file,
                fileContent,
                config,
                abortController.signal,
                (progress) => this.update_file_progress(id, 30 + (progress * 0.7), 'uploading')
            );
            
            this.update_file_progress(id, 100, 'complete');
            this.selected_files.set(id, { ...fileData, status: 'complete', result });
            
            return result;
            
        } catch (error) {
            this.update_file_progress(id, 0, 'error', error.message);
            this.selected_files.set(id, { ...fileData, status: 'error', error: error.message });
            throw error;
        }
    }
    
    async read_file_safely(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            this.activeReaders.add(reader);
            
            // Set timeout for large files
            const timeout = setTimeout(() => {
                if (this.activeReaders.has(reader)) {
                    reader.abort();
                    this.activeReaders.delete(reader);
                    reject(new Error('File reading timeout'));
                }
            }, 60000); // 60 second timeout
            
            reader.onload = () => {
                clearTimeout(timeout);
                this.activeReaders.delete(reader);
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            
            reader.onerror = () => {
                clearTimeout(timeout);
                this.activeReaders.delete(reader);
                reject(new Error('File reading failed'));
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    async upload_with_retry(file, fileContent, config, signal, progressCallback) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.options.retry_attempts; attempt++) {
            try {
                if (signal.aborted) {
                    throw new Error('Upload cancelled');
                }
                
                const response = await frappe.call({
                    method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.upload_file_to_products',
                    args: {
                        file_content: fileContent,
                        filename: file.name,
                        folder_path: config.folder_path,
                        reference_doctype: config.reference_doctype,
                        reference_docname: config.reference_docname,
                        description: config.description,
                        tags: config.tags
                    },
                    callback: (r) => {
                        if (progressCallback) {
                            progressCallback(1.0); // 100% progress
                        }
                    }
                });
                
                if (response && response.message && response.message.success) {
                    return response.message;
                } else {
                    throw new Error(response.message?.error || 'Upload failed');
                }
                
            } catch (error) {
                lastError = error;
                
                if (attempt < this.options.retry_attempts && !signal.aborted) {
                    // Wait before retry with exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                break;
            }
        }
        
        throw lastError;
    }
    
    update_file_progress(fileId, progress, status, message = '') {
        const file_item = this.dialog.$wrapper.find(`[data-file-id="${fileId}"]`);
        if (file_item.length === 0) return;
        
        const progress_bar = file_item.find('.progress-fill');
        const status_span = file_item.find('.file-status');
        
        if (progress_bar.length > 0) {
            progress_bar.css('width', `${Math.round(progress)}%`);
        }
        
        // Update status
        let status_html = '';
        let status_class = '';
        
        switch (status) {
            case 'reading':
                status_html = '<i class="fa fa-spinner fa-spin"></i> ' + __('Reading...');
                status_class = 'valid';
                break;
            case 'uploading':
                status_html = '<i class="fa fa-upload"></i> ' + __('Uploading...') + ` (${Math.round(progress)}%)`;
                status_class = 'valid';
                break;
            case 'complete':
                status_html = '<i class="fa fa-check"></i> ' + __('Complete');
                status_class = 'valid';
                break;
            case 'error':
                status_html = '<i class="fa fa-times"></i> ' + (message || __('Error'));
                status_class = 'invalid';
                break;
        }
        
        status_span.html(status_html).removeClass('valid invalid').addClass(status_class);
    }
    
    show_upload_results() {
        const { total, successful, failed, errors } = this.upload_results;
        
        let message = __('Upload completed: {0} successful, {1} failed out of {2} files', [successful, failed, total]);
        let indicator = successful === total ? 'green' : (successful > 0 ? 'orange' : 'red');
        
        if (errors.length > 0) {
            message += '\n\n' + __('Errors:');
            errors.forEach(error => {
                message += `\n• ${error.filename}: ${error.error}`;
            });
        }
        
        frappe.msgprint({
            title: __('Upload Results'),
            message: message,
            indicator: indicator
        });
        
        // Trigger callback if provided
        if (this.options.on_success && successful > 0) {
            this.options.on_success({
                successful_uploads: successful,
                total_files: total,
                results: this.upload_results
            });
        }
        
        // Auto-close dialog if all uploads successful
        if (successful === total) {
            setTimeout(() => {
                this.cleanup_and_close();
            }, 2000);
        }
    }
    
    cleanup_and_close() {
        // Clean up resources
        this.cleanup_resources();
        
        // Remove keyboard shortcuts
        $(document).off('keydown.cloud_file_uploader');
        
        // Close dialog
        if (this.dialog) {
            this.dialog.hide();
        }
    }
    
    cleanup_resources() {
        // Abort active file readers
        this.activeReaders.forEach(reader => {
            if (reader.readyState === FileReader.LOADING) {
                reader.abort();
            }
        });
        this.activeReaders.clear();
        
        // Abort active uploads
        this.abortControllers.forEach(controller => {
            controller.abort();
        });
        this.abortControllers.clear();
        
        // Clear upload queue
        this.uploadQueue = [];
        this.currentUploads = 0;
    }
    
    // Utility methods
    get_file_icon(filename) {
        const ext = this.get_file_type(filename).toLowerCase();
        
        const icons = {
            'jpg': '<i class="fa fa-file-image-o text-primary"></i>',
            'jpeg': '<i class="fa fa-file-image-o text-primary"></i>',
            'png': '<i class="fa fa-file-image-o text-primary"></i>',
            'gif': '<i class="fa fa-file-image-o text-primary"></i>',
            'pdf': '<i class="fa fa-file-pdf-o text-danger"></i>',
            'doc': '<i class="fa fa-file-word-o text-primary"></i>',
            'docx': '<i class="fa fa-file-word-o text-primary"></i>',
            'txt': '<i class="fa fa-file-text-o text-muted"></i>',
            'csv': '<i class="fa fa-file-excel-o text-success"></i>'
        };
        
        return icons[ext] || '<i class="fa fa-file-o text-muted"></i>';
    }
    
    get_file_type(filename) {
        return filename.split('.').pop() || '';
    }
    
    format_file_size(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    escape_html(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Enhanced File Validator
class FileValidator {
    constructor(options) {
        this.options = options;
    }
    
    validate_file(file) {
        try {
            // Check file size
            if (file.size > this.options.max_file_size) {
                return {
                    valid: false,
                    error: __('File size ({0}) exceeds limit ({1})', [
                        this.format_file_size(file.size),
                        this.format_file_size(this.options.max_file_size)
                    ])
                };
            }
            
            // Check file type
            const file_extension = '.' + file.name.split('.').pop().toLowerCase();
            if (!this.options.allowed_file_types.includes(file_extension)) {
                return {
                    valid: false,
                    error: __('File type {0} not allowed', [file_extension])
                };
            }
            
            // Check filename
            if (!this.is_valid_filename(file.name)) {
                return {
                    valid: false,
                    error: __('Invalid filename. Use only letters, numbers, dots, hyphens and underscores')
                };
            }
            
            // Additional security checks
            if (this.has_suspicious_content(file.name)) {
                return {
                    valid: false,
                    error: __('File appears to contain suspicious content')
                };
            }
            
            return { valid: true };
            
        } catch (error) {
            return {
                valid: false,
                error: __('Validation error: {0}', [error.message])
            };
        }
    }
    
    is_valid_filename(filename) {
        // Only allow safe characters
        const safe_pattern = /^[a-zA-Z0-9._-]+$/;
        
        // Check for dangerous patterns
        const dangerous_patterns = [
            /\.(exe|bat|cmd|scr|pif|com)$/i,
            /\.\./,
            /^\.+$/,
            /[<>:"|?*]/
        ];
        
        if (!safe_pattern.test(filename)) {
            return false;
        }
        
        for (const pattern of dangerous_patterns) {
            if (pattern.test(filename)) {
                return false;
            }
        }
        
        return true;
    }
    
    has_suspicious_content(filename) {
        const suspicious_patterns = [
            /script/i,
            /javascript/i,
            /vbscript/i,
            /onload/i,
            /onerror/i,
            /<script/i,
            /<iframe/i
        ];
        
        return suspicious_patterns.some(pattern => pattern.test(filename));
    }
    
    format_file_size(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Enhanced Cloud File List Component
class CloudFileList {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            reference_doctype: null,
            reference_docname: null,
            editable: true,
            show_upload_button: true,
            max_files_display: 50,
            enable_search: true,
            enable_filters: true,
            ...options
        };
        
        this.files = [];
        this.filtered_files = [];
        this.search_term = '';
        this.filter_type = 'all';
        
        this.render();
        this.load_files();
    }
    
    render() {
        const search_html = this.options.enable_search ? `
            <div class="file-search mb-3">
                <div class="input-group">
                    <input type="text" class="form-control" id="file-search-input" placeholder="${__('Search files...')}">
                    <div class="input-group-append">
                        <button class="btn btn-outline-secondary" type="button" id="clear-search-btn">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        ` : '';
        
        const filters_html = this.options.enable_filters ? `
            <div class="file-filters mb-3">
                <select class="form-control" id="file-type-filter" style="width: 200px; display: inline-block;">
                    <option value="all">${__('All Files')}</option>
                    <option value="images">${__('Images')}</option>
                    <option value="documents">${__('Documents')}</option>
                    <option value="public">${__('Public Files')}</option>
                    <option value="private">${__('Private Files')}</option>
                </select>
            </div>
        ` : '';
        
        const html = `
            <div class="cloud-file-list">
                <div class="cloud-file-header d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0">${__('Cloud Files')}</h5>
                    <div class="header-actions">
                        ${this.options.show_upload_button && this.options.editable ? 
                            `<button class="btn btn-primary btn-sm" id="add-cloud-files">
                                <i class="fa fa-plus"></i> ${__('Add Files')}
                            </button>` : ''}
                        <button class="btn btn-secondary btn-sm ml-2" id="refresh-files">
                            <i class="fa fa-refresh"></i> ${__('Refresh')}
                        </button>
                    </div>
                </div>
                ${search_html}
                ${filters_html}
                <div class="cloud-file-items" id="cloud-file-items">
                    <div class="text-center text-muted py-4">
                        <i class="fa fa-spinner fa-spin fa-2x"></i>
                        <p class="mt-2">${__('Loading files...')}</p>
                    </div>
                </div>
                <div class="file-list-footer mt-3" id="file-list-footer" style="display: none;">
                    <small class="text-muted">
                        <span id="files-count">0</span> ${__('files')} • 
                        <span id="total-size">0 Bytes</span> ${__('total')}
                    </small>
                </div>
            </div>
        `;
        
        $(this.container).html(html);
        this.setup_event_handlers();
    }
    
    setup_event_handlers() {
        const container = $(this.container);
        
        // Upload button
        container.find('#add-cloud-files').on('click', () => {
            new CloudFileUploader({
                reference_doctype: this.options.reference_doctype,
                reference_docname: this.options.reference_docname,
                on_success: () => this.load_files()
            });
        });
        
        // Refresh button
        container.find('#refresh-files').on('click', () => {
            this.load_files();
        });
        
        // Search functionality
        container.find('#file-search-input').on('input', debounce((e) => {
            this.search_term = e.target.value.toLowerCase();
            this.filter_and_render();
        }, 300));
        
        container.find('#clear-search-btn').on('click', () => {
            container.find('#file-search-input').val('');
            this.search_term = '';
            this.filter_and_render();
        });
        
        // Filter functionality
        container.find('#file-type-filter').on('change', (e) => {
            this.filter_type = e.target.value;
            this.filter_and_render();
        });
    }
    
    async load_files() {
        const items_container = $(this.container).find('#cloud-file-items');
        
        try {
            items_container.html(`
                <div class="text-center text-muted py-4">
                    <i class="fa fa-spinner fa-spin fa-2x"></i>
                    <p class="mt-2">${__('Loading files...')}</p>
                </div>
            `);
            
            const response = await frappe.call({
                method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.get_files_by_reference',
                args: {
                    reference_doctype: this.options.reference_doctype,
                    reference_docname: this.options.reference_docname
                }
            });
            
            this.files = response.message || [];
            this.filter_and_render();
            
        } catch (error) {
            console.error('Error loading files:', error);
            items_container.html(`
                <div class="text-center text-danger py-4">
                    <i class="fa fa-exclamation-triangle fa-2x"></i>
                    <p class="mt-2">${__('Error loading files')}</p>
                    <button class="btn btn-sm btn-primary" onclick="$(this).closest('.cloud-file-list').find('#refresh-files').click()">
                        ${__('Try Again')}
                    </button>
                </div>
            `);
        }
    }
    
    filter_and_render() {
        // Apply filters
        this.filtered_files = this.files.filter(file => {
            // Search filter
            if (this.search_term) {
                const searchable = `${file.file_name} ${file.tags || ''} ${file.description || ''}`.toLowerCase();
                if (!searchable.includes(this.search_term)) {
                    return false;
                }
            }
            
            // Type filter
            if (this.filter_type !== 'all') {
                switch (this.filter_type) {
                    case 'images':
                        if (!file.file_type || !file.file_type.match(/\.(jpg|jpeg|png|gif)$/i)) {
                            return false;
                        }
                        break;
                    case 'documents':
                        if (!file.file_type || !file.file_type.match(/\.(pdf|doc|docx|txt)$/i)) {
                            return false;
                        }
                        break;
                    case 'public':
                        if (!file.is_public) {
                            return false;
                        }
                        break;
                    case 'private':
                        if (file.is_public) {
                            return false;
                        }
                        break;
                }
            }
            
            return true;
        });
        
        this.render_files();
        this.update_footer();
    }
    
    render_files() {
        const items_container = $(this.container).find('#cloud-file-items');
        
        if (this.filtered_files.length === 0) {
            const message = this.files.length === 0 ? 
                __('No files found') : 
                __('No files match your search criteria');
                
            items_container.html(`
                <div class="text-center text-muted py-4">
                    <i class="fa fa-folder-open fa-2x"></i>
                    <p class="mt-2">${message}</p>
                </div>
            `);
            return;
        }
        
        const files_to_show = this.filtered_files.slice(0, this.options.max_files_display);
        let html = '';
        
        files_to_show.forEach(file => {
            html += this.render_file_item(file);
        });
        
        if (this.filtered_files.length > this.options.max_files_display) {
            html += `
                <div class="text-center text-muted py-3">
                    <small>${__('Showing {0} of {1} files', [this.options.max_files_display, this.filtered_files.length])}</small>
                </div>
            `;
        }
        
        items_container.html(html);
    }
    
    render_file_item(file) {
        const icon = this.get_file_icon(file.file_type);
        const size = this.format_file_size(file.file_size);
        const date = frappe.datetime.str_to_user(file.upload_date || file.creation);
        
        return `
            <div class="cloud-file-item border rounded p-3 mb-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="file-info flex-grow-1">
                        <div class="d-flex align-items-center mb-2">
                            <span class="file-icon mr-2">${icon}</span>
                            <h6 class="mb-0 font-weight-bold text-truncate">${this.escape_html(file.file_name)}</h6>
                        </div>
                        <div class="file-details text-muted small">
                            <div class="mb-1">
                                ${__('Size')}: ${size} • 
                                ${__('Type')}: ${file.file_type || __('Unknown')} • 
                                ${__('Uploaded')}: ${date}
                            </div>
                            ${file.description ? `<div class="mb-1">${__('Description')}: ${this.escape_html(file.description)}</div>` : ''}
                            ${file.tags ? `<div class="mb-1">${__('Tags')}: <span class="badge badge-secondary">${this.escape_html(file.tags)}</span></div>` : ''}
                            <div>${__('Folder')}: <code>${file.folder_path}</code></div>
                        </div>
                    </div>
                    <div class="file-actions ml-3">
                        <div class="btn-group btn-group-sm" role="group">
                            ${file.file_url ? `
                                <a href="${file.file_url}" target="_blank" class="btn btn-outline-primary" title="${__('View File')}">
                                    <i class="fa fa-eye"></i>
                                </a>
                            ` : ''}
                            ${file.s3_url ? `
                                <a href="${file.s3_url}" target="_blank" class="btn btn-outline-info" title="${__('View on S3')}">
                                    <i class="fa fa-cloud"></i>
                                </a>
                            ` : ''}
                            ${this.options.editable ? `
                                <button class="btn btn-outline-danger delete-file-btn" data-file-name="${file.name}" title="${__('Delete File')}">
                                    <i class="fa fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    update_footer() {
        const footer = $(this.container).find('#file-list-footer');
        const total_size = this.filtered_files.reduce((sum, file) => sum + (file.file_size || 0), 0);
        
        footer.find('#files-count').text(this.filtered_files.length);
        footer.find('#total-size').text(this.format_file_size(total_size));
        footer.show();
    }
    
    // Utility methods (same as CloudFileUploader)
    get_file_icon(file_type) {
        if (!file_type) return '<i class="fa fa-file-o text-muted"></i>';
        
        const ext = file_type.toLowerCase().replace('.', '');
        const icons = {
            'jpg': '<i class="fa fa-file-image-o text-primary"></i>',
            'jpeg': '<i class="fa fa-file-image-o text-primary"></i>',
            'png': '<i class="fa fa-file-image-o text-primary"></i>',
            'gif': '<i class="fa fa-file-image-o text-primary"></i>',
            'pdf': '<i class="fa fa-file-pdf-o text-danger"></i>',
            'doc': '<i class="fa fa-file-word-o text-primary"></i>',
            'docx': '<i class="fa fa-file-word-o text-primary"></i>',
            'txt': '<i class="fa fa-file-text-o text-muted"></i>',
            'csv': '<i class="fa fa-file-excel-o text-success"></i>'
        };
        
        return icons[ext] || '<i class="fa fa-file-o text-muted"></i>';
    }
    
    format_file_size(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    escape_html(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: __('File deleted successfully'),
                    indicator: 'green'
                });
                this.load_files(); // Reload the file list
            } else {
                frappe.msgprint({
                    title: __('Deletion Failed'),
                    message: response.message?.error || __('Unknown error occurred'),
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

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Global variable to track active file list instances
window.cloud_file_list_instances = new Map();

// Form Script Integration with enhanced error handling
frappe.ui.form.on('*', {
    refresh: function(frm) {
        // Add Cloud Files section to any form that needs it
        if (frm.doctype && frm.docname && frm.fields_dict.cloud_files_section) {
            const container = frm.fields_dict.cloud_files_section.$wrapper;
            const instance_key = `${frm.doctype}_${frm.docname}`;
            
            // Clean up existing instance
            if (window.cloud_file_list_instances.has(instance_key)) {
                const existing_instance = window.cloud_file_list_instances.get(instance_key);
                if (existing_instance.cleanup) {
                    existing_instance.cleanup();
                }
            }
            
            // Create new instance
            const file_list = new CloudFileList(container, {
                reference_doctype: frm.doctype,
                reference_docname: frm.docname,
                editable: !frm.doc.__islocal && frappe.model.can_write(frm.doctype)
            });
            
            window.cloud_file_list_instances.set(instance_key, file_list);
        }
    },
    
    before_save: function(frm) {
        // Optional: Validate file attachments before saving
        // This can be customized based on requirements
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
    
    return uploader;
};

// Enhanced Utility Functions
window.CloudFileUtils = {
    
    // Upload single file programmatically with enhanced error handling
    async uploadFile(file_content, filename, options = {}) {
        try {
            const validator = new FileValidator({
                allowed_file_types: options.allowed_file_types || ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.txt'],
                max_file_size: options.max_file_size || 10 * 1024 * 1024
            });
            
            // Validate filename
            if (!validator.is_valid_filename(filename)) {
                throw new Error('Invalid filename');
            }
            
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
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    },
    
    // Get files for a document with caching
    async getFiles(reference_doctype, reference_docname, use_cache = true) {
        const cache_key = `cloud_files_${reference_doctype}_${reference_docname}`;
        
        if (use_cache) {
            const cached = sessionStorage.getItem(cache_key);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    // Check if cache is still valid (5 minutes)
                    if (Date.now() - parsed.timestamp < 300000) {
                        return parsed.data;
                    }
                } catch (e) {
                    // Invalid cache, continue to fetch
                }
            }
        }
        
        try {
            const response = await frappe.call({
                method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.get_files_by_reference',
                args: {
                    reference_doctype: reference_doctype,
                    reference_docname: reference_docname
                }
            });
            
            const files = response.message || [];
            
            // Cache the result
            if (use_cache) {
                sessionStorage.setItem(cache_key, JSON.stringify({
                    data: files,
                    timestamp: Date.now()
                }));
            }
            
            return files;
        } catch (error) {
            console.error('Error getting files:', error);
            return [];
        }
    },
    
    // Delete file with confirmation and cleanup
    async deleteFile(cloud_file_name, confirm_deletion = true) {
        if (confirm_deletion) {
            const confirmed = await new Promise(resolve => {
                frappe.confirm(
                    __('Are you sure you want to delete this file? This action cannot be undone.'),
                    () => resolve(true),
                    () => resolve(false)
                );
            });
            
            if (!confirmed) return { success: false, cancelled: true };
        }
        
        try {
            const response = await frappe.call({
                method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.delete_cloud_file',
                args: {
                    cloud_file_name: cloud_file_name
                }
            });
            
            // Clear related cache
            this.clearFileCache();
            
            return response.message;
        } catch (error) {
            console.error('Delete error:', error);
            throw error;
        }
    },
    
    // Search files with advanced filtering
    async searchFiles(search_term, options = {}) {
        try {
            const response = await frappe.call({
                method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.search_files',
                args: {
                    search_term: search_term,
                    file_type: options.file_type,
                    folder_path: options.folder_path,
                    limit: options.limit || 50
                }
            });
            
            return response.message || [];
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    },
    
    // Get file statistics
    async getFileStats() {
        try {
            const response = await frappe.call({
                method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.get_file_stats'
            });
            
            return response.message || {};
        } catch (error) {
            console.error('Stats error:', error);
            return {};
        }
    },
    
    // Show file uploader dialog with enhanced options
    showUploader(options = {}) {
        return new CloudFileUploader({
            // Default options with security considerations
            max_file_size: 10 * 1024 * 1024, // 10MB
            allowed_file_types: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt', '.csv'],
            max_concurrent_uploads: 3,
            retry_attempts: 3,
            ...options
        });
    },
    
    // Bulk operations
    async bulkDelete(file_names, confirm_deletion = true) {
        if (confirm_deletion) {
            const confirmed = await new Promise(resolve => {
                frappe.confirm(
                    __('Are you sure you want to delete {0} files? This action cannot be undone.', [file_names.length]),
                    () => resolve(true),
                    () => resolve(false)
                );
            });
            
            if (!confirmed) return { success: false, cancelled: true };
        }
        
        const results = [];
        const batch_size = 5; // Process in batches to avoid overwhelming the server
        
        for (let i = 0; i < file_names.length; i += batch_size) {
            const batch = file_names.slice(i, i + batch_size);
            const batch_promises = batch.map(name => 
                this.deleteFile(name, false).catch(error => ({ 
                    success: false, 
                    error: error.message,
                    file_name: name 
                }))
            );
            
            const batch_results = await Promise.all(batch_promises);
            results.push(...batch_results);
        }
        
        // Clear cache after bulk operations
        this.clearFileCache();
        
        return {
            success: true,
            results: results,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        };
    },
    
    // Utility functions
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    getFileIcon(file_type) {
        if (!file_type) return 'fa-file-o';
        
        const ext = file_type.toLowerCase().replace('.', '');
        const icons = {
            'jpg': 'fa-file-image-o',
            'jpeg': 'fa-file-image-o', 
            'png': 'fa-file-image-o',
            'gif': 'fa-file-image-o',
            'pdf': 'fa-file-pdf-o',
            'doc': 'fa-file-word-o',
            'docx': 'fa-file-word-o',
            'txt': 'fa-file-text-o',
            'csv': 'fa-file-excel-o',
            'xls': 'fa-file-excel-o',
            'xlsx': 'fa-file-excel-o'
        };
        
        return icons[ext] || 'fa-file-o';
    },
    
    clearFileCache() {
        // Clear all cached file data
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('cloud_files_')) {
                sessionStorage.removeItem(key);
            }
        }
    },
    
    // Export files list to CSV
    exportToCSV(files, filename = 'cloud_files_export.csv') {
        const headers = ['File Name', 'File Type', 'Size', 'Folder Path', 'Upload Date', 'Uploaded By', 'Tags', 'Description'];
        let csv = headers.join(',') + '\n';
        
        files.forEach(file => {
            const row = [
                `"${file.file_name || ''}"`,
                `"${file.file_type || ''}"`,
                file.file_size || 0,
                `"${file.folder_path || ''}"`,
                `"${file.upload_date || file.creation || ''}"`,
                `"${file.uploaded_by || ''}"`,
                `"${file.tags || ''}"`,
                `"${file.description || ''}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

// Global cleanup function for page unload
window.addEventListener('beforeunload', () => {
    // Clean up all active file list instances
    window.cloud_file_list_instances.forEach(instance => {
        if (instance.cleanup) {
            instance.cleanup();
        }
    });
    window.cloud_file_list_instances.clear();
});

// Initialize on DOM ready
$(document).ready(() => {
    // Setup global error handlers for file operations
    $(document).on('click', '.delete-file-btn', async function(e) {
        e.preventDefault();
        const file_name = $(this).data('file-name');
        const file_list_container = $(this).closest('.cloud-file-list');
        
        if (file_name) {
            try {
                await window.CloudFileUtils.deleteFile(file_name);
                // Refresh the specific file list
                const refresh_btn = file_list_container.find('#refresh-files');
                if (refresh_btn.length > 0) {
                    refresh_btn.click();
                }
            } catch (error) {
                console.error('Delete failed:', error);
            }
        }
    });
    
    // Setup drag and drop for entire document (optional global handler)
    let drag_counter = 0;
    
    $(document).on('dragenter', (e) => {
        e.preventDefault();
        drag_counter++;
        if (drag_counter === 1) {
            $('body').addClass('dragging-files');
        }
    });
    
    $(document).on('dragleave', (e) => {
        drag_counter--;
        if (drag_counter === 0) {
            $('body').removeClass('dragging-files');
        }
    });
    
    $(document).on('drop', (e) => {
        e.preventDefault();
        drag_counter = 0;
        $('body').removeClass('dragging-files');
    });
});

// CSS for global drag and drop indicator
if (!document.getElementById('cloud-file-global-styles')) {
    const style = document.createElement('style');
    style.id = 'cloud-file-global-styles';
    style.textContent = `
        body.dragging-files::after {
            content: 'Drop files to upload';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(59, 130, 246, 0.9);
            color: white;
            padding: 20px 40px;
            border-radius: 8px;
            font-size: 18px;
            font-weight: bold;
            z-index: 9999;
            pointer-events: none;
        }
        body.dragging-files::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(59, 130, 246, 0.1);
            z-index: 9998;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}