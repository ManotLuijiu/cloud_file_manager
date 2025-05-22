frappe.pages['cloud-file-uploader'].on_page_load = function (wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __('Cloud File Uploader'),
    single_column: true,
  });

  // Store page reference for global access
  frappe.cloud_file_manager_page = page;

  // Add page actions
  page.add_action_icon('refresh', function () {
    refresh_page_data();
  });

  page.add_action_icon('settings', function () {
    show_settings_dialog();
  });

  // Add menu items for advanced features
  page.add_menu_item(
    __('Bulk Import'),
    function () {
      show_bulk_import_dialog();
    },
    'upload',
  );

  page.add_menu_item(
    __('Generate Report'),
    function () {
      generate_file_report();
    },
    'file-text',
  );

  page.add_menu_item(
    __('Cleanup Orphaned'),
    function () {
      cleanup_orphaned_files();
    },
    'trash-2',
  );

  page.add_menu_item(
    __('Export File List'),
    function () {
      export_file_list();
    },
    'download',
  );

  page.add_menu_item(
    __('Scan Existing Files'),
    function () {
      scan_existing_files_dialog();
    },
    'search',
  );

  // Add keyboard shortcut info
  page.add_menu_item(
    __('Keyboard Shortcuts'),
    function () {
      show_shortcuts_dialog();
    },
    'help-circle',
  );

  // Initialize custom styles
  add_custom_styles();
};

frappe.pages['cloud-file-uploader'].on_page_show = function (wrapper) {
  load_desk_page(wrapper);
  setup_keyboard_shortcuts();
};

frappe.pages['cloud-file-uploader'].on_page_hide = function () {
  cleanup_keyboard_shortcuts();
};

function load_desk_page(wrapper) {
  const $parent = $(wrapper).find('.layout-main-section');
  $parent.empty();

  // Add React root container
  const react_container = $(`
    <div class="cloud-file-manager-page">
        <div id="cloud-file-uploader-react-root" class="w-100 h-100"></div>
    </div>
`);

  $parent.append(react_container);

  frappe
    .require('cloud_file_uploader.bundle.jsx')
    .then(() => {
      console.log('Cloud File Manager React bundle loaded');

      // Fallback initialization if auto-init fails
      setTimeout(() => {
        if (!document.getElementById('cloud-file-uploader-react-root')) {
          initialize_react_component();
        }
      }, 1000);
      // frappe.cloud_file_uploader = new frappe.ui.CloudFileUploader({
      //   wrapper: $parent,
      //   page: wrapper.page,
      // });

      // Check if React components are available
      // if (window.ClouFileManager && window.React && window.ReactDOM) {
      //   initialize_react_components($parent);
      // } else {
      //   initialize_frappe_ui_class($parent, wrapper);
      // }
    })
    .catch((error) => {
      console.error('Error loading React bundle:', error);
      // initialize_frappe_ui_class($parent, wrapper);
      show_fallback_interface($parent);
    });
}

function initialize_react_component() {
  // This will be called by the bundle, but we can also trigger it manually
  if (window.CloudFileManager && window.React && window.ReactDOM) {
    const container = document.getElementById('cloud-file-uploader-react-root');
    if (container && !container.hasChildNodes()) {
      const root = ReactDOM.createRoot
        ? ReactDOM.createRoot(container)
        : ReactDOM.render;

      if (ReactDOM.createRoot) {
        root.render(React.createElement(window.CloudFileManager));
      } else {
        root(React.createElement(window.CloudFileManager), container);
      }
    }
  }
}

function show_fallback_interface($parent) {
  // Fallback interface if React fails to load
  const fallback_html = `
      <div class="fallback-interface p-4">
          <div class="alert alert-warning">
              <h4>React Component Loading Issue</h4>
              <p>The React interface could not be loaded. Using fallback interface.</p>
          </div>
          
          <div class="row">
              <div class="col-md-6">
                  <div class="card">
                      <div class="card-header">
                          <h5>Upload Files</h5>
                      </div>
                      <div class="card-body">
                          <button class="btn btn-primary" onclick="show_basic_uploader()">
                              <i class="fa fa-upload"></i> Upload Files
                          </button>
                      </div>
                  </div>
              </div>
              
              <div class="col-md-6">
                  <div class="card">
                      <div class="card-header">
                          <h5>File Management</h5>
                      </div>
                      <div class="card-body">
                          <button class="btn btn-info mr-2" onclick="show_file_list()">
                              <i class="fa fa-list"></i> View Files
                          </button>
                          <button class="btn btn-success" onclick="scan_existing_files_simple()">
                              <i class="fa fa-search"></i> Scan Files
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  `;

  $parent.html(fallback_html);
}

function initialize_react_components($parent) {
  // Add React root container
  const react_container = $(`
	<div class="cloud-file-manager-page">
		<div id="cloud-file-uploader-react-root" class="w-100 h-100"></div>
	</div>
`);

  $parent.append(react_container);

  // Initialize React components
  const container = document.getElementById('cloud-file-uploader-react-root');
  if (container) {
    if (ReactDOM.createRoot) {
      // React 18+
      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(window.ClouFileManager));
    } else {
      // React 17-
      ReactDOM.render(React.createElement(window.ClouFileManager), container);
    }
    console.log('Cloud File Manager React component initialized');
  }
}

function initialize_frappe_ui_class($parent, wrapper) {
  console.log('Initializing Frappe UI Class fallback');

  // Create the UI class instance as in your original code
  frappe.cloud_file_uploader = new frappe.ui.CloudFileUploader({
    wrapper: $parent,
    page: wrapper.page,
  });
}

// Define the Frappe UI Class
frappe.ui.CloudFileUploader = class CloudFileUploader {
  constructor(options) {
    this.wrapper = options.wrapper;
    this.page = options.page;
    this.make();
  }

  make() {
    this.setup_container();
    this.setup_tabs();
    this.setup_upload_section();
    this.setup_file_list_section();
    this.setup_existing_files_section();
    this.load_files();
  }

  setup_container() {
    this.container = $(`
		<div class="cloud-file-uploader-container">
			<div class="cloud-file-tabs">
				<ul class="nav nav-tabs" role="tablist">
					<li class="nav-item">
						<a class="nav-link active" data-toggle="tab" href="#upload-tab" role="tab">
							<i class="fa fa-upload"></i> ${__('Upload Files')}
						</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" data-toggle="tab" href="#files-tab" role="tab">
							<i class="fa fa-folder"></i> ${__('File Library')}
						</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" data-toggle="tab" href="#existing-tab" role="tab">
							<i class="fa fa-search"></i> ${__('Existing Files')}
						</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" data-toggle="tab" href="#analytics-tab" role="tab">
							<i class="fa fa-chart-bar"></i> ${__('Analytics')}
						</a>
					</li>
				</ul>
			</div>
			<div class="tab-content">
				<div class="tab-pane fade show active" id="upload-tab" role="tabpanel"></div>
				<div class="tab-pane fade" id="files-tab" role="tabpanel"></div>
				<div class="tab-pane fade" id="existing-tab" role="tabpanel"></div>
				<div class="tab-pane fade" id="analytics-tab" role="tabpanel"></div>
			</div>
		</div>
	`);

    this.wrapper.append(this.container);
  }

  setup_tabs() {
    // Tab switching logic
    this.container.find('.nav-link').on('click', (e) => {
      const target = $(e.target).attr('href');
      if (target === '#files-tab') {
        this.load_files();
      } else if (target === '#existing-tab') {
        this.load_existing_files_section();
      } else if (target === '#analytics-tab') {
        this.load_analytics();
      }
    });
  }

  setup_upload_section() {
    const upload_html = `
		<div class="upload-section p-4">
			<div class="row">
				<div class="col-md-6">
					<div class="card">
						<div class="card-header">
							<h5>${__('Upload Configuration')}</h5>
						</div>
						<div class="card-body">
							<div class="form-group">
								<label>${__('Folder Path')}</label>
								<input type="text" class="form-control" id="folder-path" 
									   value="public/files/products" placeholder="public/files/products">
							</div>
							<div class="form-group">
								<label>${__('Reference DocType')}</label>
								<input type="text" class="form-control" id="reference-doctype" 
									   placeholder="Item">
							</div>
							<div class="form-group">
								<label>${__('Reference Document')}</label>
								<input type="text" class="form-control" id="reference-docname" 
									   placeholder="ITEM-001">
							</div>
							<div class="form-group">
								<label>${__('Tags')}</label>
								<input type="text" class="form-control" id="tags" 
									   placeholder="product, image, catalog">
							</div>
							<div class="form-group">
								<label>${__('Description')}</label>
								<textarea class="form-control" id="description" rows="3" 
										  placeholder="File description..."></textarea>
							</div>
						</div>
					</div>
				</div>
				<div class="col-md-6">
					<div class="card">
						<div class="card-header">
							<h5>${__('File Upload')}</h5>
						</div>
						<div class="card-body">
							<div class="upload-area" id="upload-area">
								<div class="upload-drop-zone">
									<i class="fa fa-cloud-upload fa-3x text-muted mb-3"></i>
									<p class="lead">${__('Drop files here or click to browse')}</p>
									<button class="btn btn-primary" id="browse-files">
										<i class="fa fa-plus"></i> ${__('Select Files')}
									</button>
									<input type="file" id="file-input" multiple style="display: none;">
								</div>
							</div>
							<div class="upload-progress mt-3" id="upload-progress" style="display: none;">
								<div class="progress">
									<div class="progress-bar" role="progressbar" style="width: 0%"></div>
								</div>
								<small class="text-muted" id="upload-status"></small>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	`;

    this.container.find('#upload-tab').html(upload_html);
    this.setup_upload_handlers();
  }

  setup_upload_handlers() {
    const self = this;
    const $uploadArea = this.container.find('#upload-area');
    const $fileInput = this.container.find('#file-input');
    const $browseBtn = this.container.find('#browse-files');

    // Browse button click
    $browseBtn.on('click', () => $fileInput.click());

    // File input change
    $fileInput.on('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        this.handle_file_upload(files);
      }
    });

    // Drag and drop
    $uploadArea.on('dragover', (e) => {
      e.preventDefault();
      $uploadArea.addClass('drag-over');
    });

    $uploadArea.on('dragleave', (e) => {
      e.preventDefault();
      $uploadArea.removeClass('drag-over');
    });

    $uploadArea.on('drop', (e) => {
      e.preventDefault();
      $uploadArea.removeClass('drag-over');
      const files = Array.from(e.originalEvent.dataTransfer.files);
      if (files.length > 0) {
        this.handle_file_upload(files);
      }
    });
  }

  async handle_file_upload(files) {
    const config = {
      folder_path: this.container.find('#folder-path').val(),
      reference_doctype: this.container.find('#reference-doctype').val(),
      reference_docname: this.container.find('#reference-docname').val(),
      tags: this.container.find('#tags').val(),
      description: this.container.find('#description').val(),
    };

    const $progress = this.container.find('#upload-progress');
    const $progressBar = $progress.find('.progress-bar');
    const $status = this.container.find('#upload-status');

    $progress.show();
    $status.text(__('Preparing upload...'));

    try {
      let completed = 0;
      const total = files.length;

      for (const file of files) {
        const fileContent = await this.file_to_base64(file);

        await frappe.call({
          method:
            'cloud_file_manager.doctype.cloud_file.cloud_file.upload_file_to_products',
          args: {
            file_content: fileContent,
            filename: file.name,
            folder_path: config.folder_path,
            reference_doctype: config.reference_doctype,
            reference_docname: config.reference_docname,
            description: config.description,
            tags: config.tags,
          },
        });

        completed++;
        const progress = (completed / total) * 100;
        $progressBar.css('width', progress + '%');
        $status.text(__(`Uploaded ${completed} of ${total} files`));
      }

      frappe.show_alert({
        message: __(`Successfully uploaded ${completed} files`),
        indicator: 'green',
      });

      $progress.hide();
      this.load_files();
    } catch (error) {
      console.error('Upload error:', error);
      frappe.msgprint({
        title: __('Upload Error'),
        message: error.message || __('Failed to upload files'),
        indicator: 'red',
      });
      $progress.hide();
    }
  }

  file_to_base64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  setup_file_list_section() {
    const files_html = `
		<div class="files-section p-4">
			<div class="d-flex justify-content-between align-items-center mb-3">
				<h4>${__('File Library')}</h4>
				<div class="file-controls">
					<input type="text" class="form-control d-inline-block w-auto mr-2" 
						   id="file-search" placeholder="${__('Search files...')}">
					<select class="form-control d-inline-block w-auto mr-2" id="file-filter">
						<option value="all">${__('All Files')}</option>
						<option value="images">${__('Images')}</option>
						<option value="documents">${__('Documents')}</option>
						<option value="public">${__('Public')}</option>
						<option value="private">${__('Private')}</option>
					</select>
					<button class="btn btn-secondary" id="refresh-files">
						<i class="fa fa-refresh"></i> ${__('Refresh')}
					</button>
				</div>
			</div>
			<div class="file-list" id="file-list">
				<div class="text-center p-4">
					<i class="fa fa-spinner fa-spin fa-2x"></i>
					<p class="mt-2">${__('Loading files...')}</p>
				</div>
			</div>
		</div>
	`;

    this.container.find('#files-tab').html(files_html);
    this.setup_file_list_handlers();
  }

  setup_file_list_handlers() {
    const $search = this.container.find('#file-search');
    const $filter = this.container.find('#file-filter');
    const $refresh = this.container.find('#refresh-files');

    $search.on('input', () => this.filter_files());
    $filter.on('change', () => this.filter_files());
    $refresh.on('click', () => this.load_files());
  }

  async load_files() {
    const $fileList = this.container.find('#file-list');

    try {
      const response = await frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Cloud File',
          fields: ['*'],
          limit_page_length: 100,
          order_by: 'creation desc',
        },
      });

      this.files = response.message || [];
      this.render_file_list();
    } catch (error) {
      console.error('Error loading files:', error);
      $fileList.html(`
			<div class="text-center p-4 text-danger">
				<i class="fa fa-exclamation-triangle fa-2x"></i>
				<p class="mt-2">${__('Error loading files')}</p>
			</div>
		`);
    }
  }

  render_file_list() {
    const $fileList = this.container.find('#file-list');

    if (!this.files || this.files.length === 0) {
      $fileList.html(`
			<div class="text-center p-4 text-muted">
				<i class="fa fa-folder-open fa-2x"></i>
				<p class="mt-2">${__('No files found')}</p>
			</div>
		`);
      return;
    }

    let html = '';
    this.filtered_files = this.get_filtered_files();

    // biome-ignore lint/complexity/noForEach: <explanation>
    this.filtered_files.forEach((file) => {
      html += `
			<div class="file-item card mb-2">
				<div class="card-body">
					<div class="d-flex justify-content-between align-items-center">
						<div class="file-info">
							<h6 class="card-title mb-1">
								<i class="fa ${this.get_file_icon(file.file_type)}"></i>
								${file.file_name}
							</h6>
							<small class="text-muted">
								${this.format_file_size(file.file_size)} • ${file.folder_path}
								${file.tags ? `<br><span class="badge badge-secondary">${file.tags}</span>` : ''}
							</small>
						</div>
						<div class="file-actions">
							${
                file.file_url
                  ? `<a href="${file.file_url}" target="_blank" class="btn btn-sm btn-outline-primary mr-1">
								<i class="fa fa-eye"></i> ${__('View')}
							</a>`
                  : ''
              }
							${
                file.s3_url
                  ? `<a href="${file.s3_url}" target="_blank" class="btn btn-sm btn-outline-info mr-1">
								<i class="fa fa-cloud"></i> ${__('S3')}
							</a>`
                  : ''
              }
							<button class="btn btn-sm btn-outline-danger" onclick="frappe.cloud_file_uploader.delete_file('${file.name}')">
								<i class="fa fa-trash"></i> ${__('Delete')}
							</button>
						</div>
					</div>
				</div>
			</div>
		`;
    });

    $fileList.html(html);
  }

  get_filtered_files() {
    if (!this.files) return [];

    const searchTerm = this.container.find('#file-search').val().toLowerCase();
    const filterType = this.container.find('#file-filter').val();

    return this.files.filter((file) => {
      const matchesSearch =
        !searchTerm ||
        file.file_name.toLowerCase().includes(searchTerm) ||
        // biome-ignore lint/complexity/useOptionalChain: <explanation>
        (file.tags && file.tags.toLowerCase().includes(searchTerm));

      const matchesFilter =
        filterType === 'all' ||
        (filterType === 'images' &&
          file.file_type &&
          file.file_type.match(/\.(jpg|jpeg|png|gif)$/i)) ||
        (filterType === 'documents' &&
          file.file_type &&
          file.file_type.match(/\.(pdf|doc|docx)$/i)) ||
        (filterType === 'public' && file.is_public) ||
        (filterType === 'private' && !file.is_public);

      return matchesSearch && matchesFilter;
    });
  }

  filter_files() {
    this.render_file_list();
  }

  get_file_icon(fileType) {
    if (!fileType) return 'fa-file';

    if (fileType.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return 'fa-file-image text-primary';
      // biome-ignore lint/style/noUselessElse: <explanation>
    } else if (fileType.match(/\.(pdf)$/i)) {
      return 'fa-file-pdf text-danger';
      // biome-ignore lint/style/noUselessElse: <explanation>
    } else if (fileType.match(/\.(doc|docx)$/i)) {
      return 'fa-file-word text-primary';
      // biome-ignore lint/style/noUselessElse: <explanation>
    } else if (fileType.match(/\.(xls|xlsx)$/i)) {
      return 'fa-file-excel text-success';
    }

    return 'fa-file';
  }

  format_file_size(bytes) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async delete_file(fileName) {
    if (!confirm(__('Are you sure you want to delete this file?'))) return;

    try {
      await frappe.call({
        method:
          'cloud_file_manager.doctype.cloud_file.cloud_file.delete_cloud_file',
        args: { cloud_file_name: fileName },
      });

      frappe.show_alert({
        message: __('File deleted successfully'),
        indicator: 'green',
      });

      this.load_files();
    } catch (error) {
      frappe.msgprint({
        title: __('Delete Error'),
        message: error.message || __('Failed to delete file'),
        indicator: 'red',
      });
    }
  }

  setup_existing_files_section() {
    const existing_html = `
		<div class="existing-files-section p-4">
			<h4>${__('Existing Files Management')}</h4>
			<div class="row">
				<div class="col-md-4">
					<button class="btn btn-primary btn-block mb-2" id="scan-existing">
						<i class="fa fa-search"></i> ${__('Scan Files')}
					</button>
				</div>
				<div class="col-md-4">
					<button class="btn btn-success btn-block mb-2" id="migrate-files">
						<i class="fa fa-arrow-right"></i> ${__('Migrate Files')}
					</button>
				</div>
				<div class="col-md-4">
					<button class="btn btn-warning btn-block mb-2" id="cleanup-orphaned">
						<i class="fa fa-trash"></i> ${__('Cleanup Orphaned')}
					</button>
				</div>
			</div>
			<div class="scan-results mt-4" id="scan-results" style="display: none;"></div>
		</div>
	`;

    this.container.find('#existing-tab').html(existing_html);
    this.setup_existing_files_handlers();
  }

  setup_existing_files_handlers() {
    this.container
      .find('#scan-existing')
      .on('click', () => this.scan_existing_files());
    this.container
      .find('#migrate-files')
      .on('click', () => this.migrate_existing_files());
    this.container
      .find('#cleanup-orphaned')
      .on('click', () => cleanup_orphaned_files());
  }

  async scan_existing_files() {
    const $results = this.container.find('#scan-results');
    $results
      .show()
      .html(
        '<div class="text-center p-3"><i class="fa fa-spinner fa-spin"></i> Scanning files...</div>',
      );

    try {
      const response = await frappe.call({
        method:
          'cloud_file_manager.doctype.cloud_file.existing_files_manager.scan_existing_files',
        args: {
          folder_path: null,
          include_subfolders: true,
        },
      });

      this.scan_results = response.message;
      this.render_scan_results();
    } catch (error) {
      $results.html(
        `<div class="alert alert-danger">Error scanning files: ${error.message}</div>`,
      );
    }
  }

  render_scan_results() {
    const results = this.scan_results;
    const $results = this.container.find('#scan-results');

    const html = `
		<div class="card">
			<div class="card-header">
				<h5>${__('Scan Results')}</h5>
			</div>
			<div class="card-body">
				<div class="row text-center">
					<div class="col-md-3">
						<h4 class="text-primary">${results.total_files}</h4>
						<small>${__('Total Files')}</small>
					</div>
					<div class="col-md-3">
						<h4 class="text-warning">${results.untracked_files ? results.untracked_files.length : 0}</h4>
						<small>${__('Untracked')}</small>
					</div>
					<div class="col-md-3">
						<h4 class="text-danger">${results.orphaned_records ? results.orphaned_records.length : 0}</h4>
						<small>${__('Orphaned')}</small>
					</div>
					<div class="col-md-3">
						<h4 class="text-success">${Object.keys(results.files_by_folder || {}).length}</h4>
						<small>${__('Folders')}</small>
					</div>
				</div>
				${
          results.untracked_files && results.untracked_files.length > 0
            ? `
					<div class="alert alert-warning mt-3">
						<p><strong>${__('Untracked Files Found')}</strong></p>
						<p>${__('Found')} ${results.untracked_files.length} ${__('files that are not tracked in the Cloud File system.')}</p>
					</div>
				`
            : ''
        }
			</div>
		</div>
	`;

    $results.html(html);
  }

  async migrate_existing_files() {
    if (!this.scan_results) {
      frappe.msgprint(__('Please run a scan first'));
      return;
    }

    const migration_config = {
      auto_organize: true,
      create_cloud_records: true,
      folder_mappings: {
        jpg: 'public/files/products/images',
        png: 'public/files/products/images',
        pdf: 'public/files/documents/pdf',
      },
    };

    try {
      const response = await frappe.call({
        method:
          'cloud_file_manager.doctype.cloud_file.existing_files_manager.migrate_existing_files',
        args: { migration_config: migration_config },
      });

      frappe.show_alert({
        message: __(
          `Migration completed: ${response.message?.migrated_files || 0} files processed`,
        ),
        indicator: 'green',
      });

      this.load_files();
    } catch (error) {
      frappe.msgprint({
        title: __('Migration Error'),
        message: error.message,
        indicator: 'red',
      });
    }
  }

  load_existing_files_section() {
    // Load existing files management content
    if (!this.container.find('#existing-tab .existing-files-section').length) {
      this.setup_existing_files_section();
    }
  }

  load_analytics() {
    const analytics_html = `
		<div class="analytics-section p-4">
			<h4>${__('File Analytics')}</h4>
			<div class="row">
				<div class="col-md-4">
					<div class="card text-center">
						<div class="card-body">
							<h3 class="text-primary" id="total-files">-</h3>
							<p>${__('Total Files')}</p>
						</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="card text-center">
						<div class="card-body">
							<h3 class="text-success" id="total-size">-</h3>
							<p>${__('Total Size')}</p>
						</div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="card text-center">
						<div class="card-body">
							<h3 class="text-info" id="file-types">-</h3>
							<p>${__('File Types')}</p>
						</div>
					</div>
				</div>
			</div>
			<div class="recent-files mt-4">
				<h5>${__('Recent Files')}</h5>
				<div class="list-group" id="recent-files-list">
					<div class="text-center p-3">
						<i class="fa fa-spinner fa-spin"></i> ${__('Loading...')}
					</div>
				</div>
			</div>
		</div>
	`;

    this.container.find('#analytics-tab').html(analytics_html);
    this.load_analytics_data();
  }

  load_analytics_data() {
    if (this.files && this.files.length > 0) {
      const totalSize = this.files.reduce(
        (sum, file) => sum + (file.file_size || 0),
        0,
      );
      const fileTypes = new Set(this.files.map((f) => f.file_type)).size;

      this.container.find('#total-files').text(this.files.length);
      this.container.find('#total-size').text(this.format_file_size(totalSize));
      this.container.find('#file-types').text(fileTypes);

      // Recent files
      const recentFiles = this.files.slice(0, 5);
      let recentHtml = '';

      // biome-ignore lint/complexity/noForEach: <explanation>
      recentFiles.forEach((file) => {
        recentHtml += `
				<div class="list-group-item">
					<div class="d-flex justify-content-between">
						<div>
							<h6 class="mb-1">
								<i class="fa ${this.get_file_icon(file.file_type)}"></i>
								${file.file_name}
							</h6>
							<small class="text-muted">${file.folder_path}</small>
						</div>
						<small class="text-muted">${frappe.datetime.str_to_user(file.creation)}</small>
					</div>
				</div>
			`;
      });

      this.container.find('#recent-files-list').html(recentHtml);
    }
  }

  refresh() {
    this.load_files();
    if (this.scan_results) {
      this.scan_existing_files();
    }
  }
};

// Page action functions
function refresh_page_data() {
  if (
    // biome-ignore lint/complexity/useOptionalChain: <explanation>
    window.CloudFileManagerInstance &&
    window.CloudFileManagerInstance.refresh
  ) {
    window.CloudFileManagerInstance.refresh();
  } else if (window.CloudFileUtils) {
    // Trigger a general refresh
    frappe.show_alert(__('Refreshing data...'), 'blue');
    setTimeout(() => {
      location.reload();
    }, 500);
  } else {
    location.reload();
  }
}

// function refresh_page_data() {
//   if (frappe.cloud_file_uploader && frappe.cloud_file_uploader.refresh) {
//     frappe.cloud_file_uploader.refresh();
//   } else if (
//     window.CloudFileManagerInstance &&
//     window.CloudFileManagerInstance.refresh
//   ) {
//     window.CloudFileManagerInstance.refresh();
//   } else {
//     location.reload();
//   }
// }

function show_settings_dialog() {
  const settings_dialog = new frappe.ui.Dialog({
    title: __('Cloud File Manager Settings'),
    fields: [
      {
        fieldtype: 'Section Break',
        label: __('Default Upload Settings'),
      },
      {
        label: __('Default Folder Path'),
        fieldname: 'default_folder_path',
        fieldtype: 'Data',
        default:
          localStorage.getItem('cloud_file_default_folder') ||
          'public/files/products',
        description: __('Default folder for file uploads'),
      },
      {
        label: __('Max File Size (MB)'),
        fieldname: 'max_file_size',
        fieldtype: 'Int',
        default:
          Number.parseInt(localStorage.getItem('cloud_file_max_size')) || 10,
        description: __('Maximum file size allowed for upload'),
      },
      {
        label: __('Allowed File Types'),
        fieldname: 'allowed_file_types',
        fieldtype: 'Data',
        default:
          localStorage.getItem('cloud_file_allowed_types') ||
          '.jpg,.png,.pdf,.doc,.docx',
        description: __(
          'Comma-separated file extensions (e.g., .jpg, .png, .pdf)',
        ),
      },
      {
        label: __('Default Tags'),
        fieldname: 'default_tags',
        fieldtype: 'Data',
        default: localStorage.getItem('cloud_file_default_tags') || '',
        description: __('Default tags to apply to uploaded files'),
      },
      {
        fieldtype: 'Section Break',
        label: __('S3 Configuration'),
      },
      {
        label: __('Enable S3 Upload'),
        fieldname: 'enable_s3',
        fieldtype: 'Check',
        default:
          Number.parseInt(localStorage.getItem('cloud_file_enable_s3')) || 0,
        description: __('Enable automatic upload to S3 cloud storage'),
      },
      {
        fieldtype: 'Section Break',
        label: __('Auto-Organization'),
        depends_on: 'eval:doc.enable_s3',
      },
      {
        label: __('Auto-organize uploaded files'),
        fieldname: 'auto_organize',
        fieldtype: 'Check',
        default:
          Number.parseInt(localStorage.getItem('cloud_file_auto_organize')) ||
          1,
        description: __('Automatically organize files by type'),
      },
      {
        label: __('Folder Mappings (JSON)'),
        fieldname: 'folder_mappings',
        fieldtype: 'Code',
        options: 'JSON',
        default:
          localStorage.getItem('cloud_file_folder_mappings') ||
          JSON.stringify(
            {
              jpg: 'public/files/products/images',
              png: 'public/files/products/images',
              pdf: 'public/files/documents/pdf',
              doc: 'public/files/documents/word',
              docx: 'public/files/documents/word',
              xls: 'public/files/documents/excel',
              xlsx: 'public/files/documents/excel',
            },
            null,
            2,
          ),
        depends_on: 'auto_organize',
        description: __('JSON mapping of file extensions to target folders'),
      },
    ],
    primary_action_label: __('Save Settings'),
    primary_action: function (values) {
      // Save settings to localStorage
      // biome-ignore lint/complexity/noForEach: <explanation>
      Object.keys(values).forEach((key) => {
        const storage_key = `cloud_file_${key}`;
        const value = values[key];

        if (typeof value === 'boolean') {
          localStorage.setItem(storage_key, value ? '1' : '0');
        } else {
          localStorage.setItem(storage_key, value);
        }
      });

      frappe.show_alert({
        message: __('Settings saved successfully'),
        indicator: 'green',
      });

      settings_dialog.hide();

      // Notify React component of settings change
      if (
        // biome-ignore lint/complexity/useOptionalChain: <explanation>
        window.CloudFileManagerInstance &&
        window.CloudFileManagerInstance.updateSettings
      ) {
        window.CloudFileManagerInstance.updateSettings(values);
      }
    },
  });

  settings_dialog.show();
}

function show_bulk_import_dialog() {
  const import_dialog = new frappe.ui.Dialog({
    title: __('Bulk Import Files'),
    size: 'large',
    fields: [
      {
        label: __('Source Directory Path'),
        fieldname: 'source_directory',
        fieldtype: 'Data',
        reqd: 1,
        description: __(
          'Full path to the directory containing files to import',
        ),
      },
      {
        fieldtype: 'Section Break',
        label: __('Import Configuration'),
      },
      {
        label: __('Target Folder'),
        fieldname: 'target_folder',
        fieldtype: 'Data',
        default: 'public/files/imported',
        reqd: 1,
      },
      {
        label: __('Preserve Directory Structure'),
        fieldname: 'preserve_structure',
        fieldtype: 'Check',
        default: 1,
      },
      {
        label: __('File Extensions to Import'),
        fieldname: 'file_extensions',
        fieldtype: 'Data',
        default: '.jpg,.png,.pdf,.doc,.docx',
        description: __('Comma-separated extensions'),
      },
      {
        label: __('Max File Size (MB)'),
        fieldname: 'max_file_size',
        fieldtype: 'Int',
        default: 10,
      },
      {
        label: __('Exclude Patterns'),
        fieldname: 'exclude_patterns',
        fieldtype: 'Data',
        default: 'temp_,backup_,~$',
        description: __('Comma-separated patterns to exclude from import'),
      },
      {
        fieldtype: 'Section Break',
        label: __('Metadata Settings'),
      },
      {
        label: __('Default Tags'),
        fieldname: 'default_tags',
        fieldtype: 'Data',
        default: 'imported, bulk-upload',
      },
      {
        label: __('Default Description'),
        fieldname: 'default_description',
        fieldtype: 'Text',
        default: 'File imported via bulk import process',
      },
      {
        label: __('Auto-detect Document References'),
        fieldname: 'auto_detect_reference',
        fieldtype: 'Check',
        default: 1,
        description: __('Try to detect document references from filenames'),
      },
    ],
    primary_action_label: __('Start Import'),
    primary_action: function (values) {
      const import_config = {
        target_folder: values.target_folder,
        preserve_structure: values.preserve_structure,
        file_filters: {
          extensions: values.file_extensions
            .split(',')
            .map((ext) => ext.trim()),
          max_size: values.max_file_size * 1024 * 1024,
          exclude_patterns: values.exclude_patterns
            .split(',')
            .map((pattern) => pattern.trim()),
        },
        metadata: {
          auto_detect_reference: values.auto_detect_reference,
          default_tags: values.default_tags,
          default_description: values.default_description,
        },
      };

      import_dialog.hide();
      start_bulk_import(values.source_directory, import_config);
    },
  });

  import_dialog.show();
}

function start_bulk_import(source_directory, import_config) {
  const progress_dialog = new frappe.ui.Dialog({
    title: __('Importing Files'),
    fields: [
      {
        fieldtype: 'HTML',
        options: `
                    <div class="import-progress text-center">
                        <div class="progress mb-3">
                            <div class="progress-bar progress-bar-striped progress-bar-animated" 
                                 role="progressbar" style="width: 0%" id="import-progress-bar"></div>
                        </div>
                        <div class="import-status">
                            <p id="import-status-text">Starting import process...</p>
                        </div>
                    </div>
                `,
      },
    ],
    secondary_action_label: __('Cancel'),
    secondary_action: function () {
      progress_dialog.hide();
    },
  });

  progress_dialog.show();

  frappe.call({
    method: 'cloud_file_manager.batch_operations.bulk_import_from_directory',
    args: {
      source_directory: source_directory,
      import_config: import_config,
    },
    freeze: false,
    callback: function (response) {
      progress_dialog.hide();

      if (response.message && !response.message.error) {
        const result = response.message;
        frappe.msgprint({
          title: __('Import Completed'),
          message: __(
            `Successfully imported ${result.imported_files || 0} files. ${result.errors ? result.errors.length : 0} errors occurred.`,
          ),
          indicator: 'green',
        });

        refresh_page_data();
      } else {
        frappe.msgprint({
          title: __('Import Failed'),
          message: response.message?.error || __('Unknown error occurred'),
          indicator: 'red',
        });
      }
    },
    error: function (error) {
      progress_dialog.hide();
      frappe.msgprint({
        title: __('Import Error'),
        message: error.message || __('Import process failed'),
        indicator: 'red',
      });
    },
  });
}

function generate_file_report() {
  frappe.show_progress(__('Generating Report'), 50, 100);

  frappe.call({
    method:
      'cloud_file_manager.doctype.cloud_file.existing_files_manager.generate_file_report',
    callback: function (response) {
      frappe.hide_progress();

      if (response.message && !response.message.error) {
        show_file_report_dialog(response.message);
      } else {
        frappe.msgprint(__('Error generating report'));
      }
    },
  });
}

function show_file_report_dialog(report) {
  const report_html = `
        <div class="file-report">
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <h3 class="text-primary">${report.summary.total_files}</h3>
                            <small>Total Files</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <h3 class="text-info">${report.summary.total_size_mb} MB</h3>
                            <small>Total Size</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <h3 class="text-warning">${report.summary.untracked_files}</h3>
                            <small>Untracked Files</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <h3 class="text-danger">${report.summary.orphaned_records}</h3>
                            <small>Orphaned Records</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

  const report_dialog = new frappe.ui.Dialog({
    title: __('File System Report'),
    size: 'large',
    fields: [
      {
        fieldtype: 'HTML',
        options: report_html,
      },
    ],
  });

  report_dialog.show();
}

function cleanup_orphaned_files() {
  frappe.confirm(
    __('Are you sure you want to clean up orphaned records?'),
    function () {
      frappe.call({
        method:
          'cloud_file_manager.doctype.cloud_file.existing_files_manager.cleanup_orphaned_records',
        callback: function (response) {
          if (response.message) {
            frappe.msgprint({
              title: __('Cleanup Complete'),
              message: __(
                `Cleaned up ${response.message.cleaned_records} orphaned records`,
              ),
              indicator: 'green',
            });
            refresh_page_data();
          }
        },
      });
    },
  );
}

function export_file_list() {
  frappe.call({
    method: 'frappe.client.get_list',
    args: {
      doctype: 'Cloud File',
      fields: ['*'],
      limit_page_length: 0,
    },
    callback: function (response) {
      if (response.message && response.message.length > 0) {
        const csv_data = convert_to_csv(response.message);
        download_csv_file(csv_data, 'cloud_files_export.csv');
        frappe.show_alert(__('File list exported'), 'green');
      } else {
        frappe.msgprint(__('No files found to export'));
      }
    },
  });
}

function convert_to_csv(data) {
  const headers = [
    'File Name',
    'File URL',
    'Size',
    'Type',
    'Folder Path',
    'Created',
  ];
  let csv = headers.join(',') + '\n';

  data.forEach((row) => {
    const csvRow = [
      `"${row.file_name || ''}"`,
      `"${row.file_url || ''}"`,
      row.file_size || 0,
      `"${row.file_type || ''}"`,
      `"${row.folder_path || ''}"`,
      `"${row.creation || ''}"`,
    ];
    csv += csvRow.join(',') + '\n';
  });

  return csv;
}

function download_csv_file(csv_data, filename) {
  const blob = new Blob([csv_data], { type: 'text/csv' });
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

function scan_existing_files_dialog() {
  const scan_dialog = new frappe.ui.Dialog({
    title: __('Scan Existing Files'),
    fields: [
      {
        label: __('Folder Path'),
        fieldname: 'folder_path',
        fieldtype: 'Data',
        description: __('Leave empty to scan all folders'),
      },
    ],
    primary_action_label: __('Start Scan'),
    primary_action: function (values) {
      scan_dialog.hide();
      if (
        // biome-ignore lint/complexity/useOptionalChain: <explanation>
        frappe.cloud_file_uploader &&
        frappe.cloud_file_uploader.scan_existing_files
      ) {
        frappe.cloud_file_uploader.scan_existing_files();
      }
    },
  });

  scan_dialog.show();
}

function migrate_untracked_files() {
  if (
    // biome-ignore lint/complexity/useOptionalChain: <explanation>
    frappe.cloud_file_uploader &&
    frappe.cloud_file_uploader.migrate_existing_files
  ) {
    frappe.cloud_file_uploader.migrate_existing_files();
  }
}

function show_shortcuts_dialog() {
  const shortcuts_html = `
        <div class="keyboard-shortcuts">
            <h5>Available Keyboard Shortcuts</h5>
            <table class="table table-sm">
                <tbody>
                    <tr><td><kbd>Ctrl</kbd> + <kbd>U</kbd></td><td>Open file uploader</td></tr>
                    <tr><td><kbd>Ctrl</kbd> + <kbd>R</kbd></td><td>Refresh page data</td></tr>
                    <tr><td><kbd>Ctrl</kbd> + <kbd>F</kbd></td><td>Focus search box</td></tr>
                </tbody>
            </table>
        </div>
    `;

  const shortcuts_dialog = new frappe.ui.Dialog({
    title: __('Keyboard Shortcuts'),
    fields: [{ fieldtype: 'HTML', options: shortcuts_html }],
  });

  shortcuts_dialog.show();
}

function setup_keyboard_shortcuts() {
  $(document).off('keydown.cloud_file_manager');
  $(document).on('keydown.cloud_file_manager', function (e) {
    if (!frappe.get_route()[0] === 'cloud-file-uploader') return;

    if (e.ctrlKey && e.key === 'u' && !e.shiftKey) {
      e.preventDefault();
      if (window.CloudFileUtils) {
        window.CloudFileUtils.showUploader();
      }
    }

    if (e.ctrlKey && e.key === 'r' && !e.shiftKey) {
      e.preventDefault();
      refresh_page_data();
    }
  });
}

function cleanup_keyboard_shortcuts() {
  $(document).off('keydown.cloud_file_manager');
}

function add_custom_styles() {
  if ($('#cloud-file-manager-styles').length) return;

  const custom_styles = $(`
        <style id="cloud-file-manager-styles">
            .cloud-file-uploader-container {
                height: calc(100vh - 150px);
                overflow: auto;
            }
            
            .upload-drop-zone {
                border: 2px dashed #ccc;
                border-radius: 8px;
                padding: 40px;
                text-align: center;
                background: #fafafa;
                transition: all 0.3s ease;
            }
            
            .upload-drop-zone.drag-over {
                border-color: #007bff;
                background: #e3f2fd;
            }
            
            .file-item {
                transition: all 0.2s ease;
            }
            
            .file-item:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            
            .progress {
                height: 20px;
                border-radius: 10px;
            }
            
            .nav-tabs .nav-link {
                border-radius: 8px 8px 0 0;
            }
            
            .card {
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
        </style>
    `);

  $('head').append(custom_styles);
}

// Global utilities
window.CloudFileManagerPage = {
  refresh: refresh_page_data,
  showSettings: show_settings_dialog,
  generateReport: generate_file_report,
  exportFiles: export_file_list,
  bulkImport: show_bulk_import_dialog,
  cleanupOrphaned: cleanup_orphaned_files,
};
