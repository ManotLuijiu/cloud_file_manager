import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, 
  File, 
  Folder, 
  Search, 
  Filter, 
  Download,
  Trash2,
  Eye,
  Cloud,
  BarChart3,
  RefreshCw,
  Settings,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dragActive, setDragActive] = useState(false);

  // File upload states
  const [uploadConfig, setUploadConfig] = useState({
    folder_path: 'public/files/products',
    reference_doctype: '',
    reference_docname: '',
    description: '',
    tags: ''
  });

  // Migration states
  const [migrationConfig, setMigrationConfig] = useState({
    auto_organize: true,
    create_cloud_records: true,
    folder_mappings: {
      "jpg": "public/files/products/images",
      "png": "public/files/products/images",
      "pdf": "public/files/documents/pdf",
      "doc": "public/files/documents/word",
      "docx": "public/files/documents/word"
    }
  });

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Cloud File',
          fields: ['*'],
          limit_page_length: 100,
          order_by: 'creation desc'
        }
      });
      
      setFiles(response.message || []);
    } catch (error) {
      console.error('Error loading files:', error);
      frappe.msgprint('Error loading files');
    } finally {
      setLoading(false);
    }
  };

  // File upload handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileUpload(droppedFiles);
  }, [uploadConfig]);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFileUpload(selectedFiles);
  };

  const handleFileUpload = async (fileList) => {
    if (fileList.length === 0) return;

    setLoading(true);
    const uploadPromises = [];

    for (const file of fileList) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder_path', uploadConfig.folder_path);
      formData.append('reference_doctype', uploadConfig.reference_doctype);
      formData.append('reference_docname', uploadConfig.reference_docname);
      formData.append('description', uploadConfig.description);
      formData.append('tags', uploadConfig.tags);

      const uploadPromise = frappe.call({
        method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.upload_file_to_products',
        args: {
          file_content: await fileToBase64(file),
          filename: file.name,
          folder_path: uploadConfig.folder_path,
          reference_doctype: uploadConfig.reference_doctype,
          reference_docname: uploadConfig.reference_docname,
          description: uploadConfig.description,
          tags: uploadConfig.tags
        }
      });

      uploadPromises.push(uploadPromise);
    }

    try {
      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r.message?.success).length;
      
      frappe.show_alert({
        message: `Successfully uploaded ${successCount} out of ${fileList.length} files`,
        indicator: 'green'
      });
      
      loadFiles(); // Refresh file list
    } catch (error) {
      console.error('Upload error:', error);
      frappe.msgprint('Error uploading files');
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Scan existing files
  const scanExistingFiles = async () => {
    setLoading(true);
    try {
      const response = await frappe.call({
        method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.existing_files_manager.scan_existing_files',
        args: {
          folder_path: null,
          include_subfolders: true
        }
      });
      
      setScanResults(response.message);
    } catch (error) {
      console.error('Scan error:', error);
      frappe.msgprint('Error scanning files');
    } finally {
      setLoading(false);
    }
  };

  // Migrate existing files
  const migrateFiles = async () => {
    setLoading(true);
    try {
      const response = await frappe.call({
        method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.existing_files_manager.migrate_existing_files',
        args: {
          migration_config: migrationConfig
        }
      });
      
      frappe.show_alert({
        message: `Migration completed: ${response.message?.migrated_files || 0} files processed`,
        indicator: 'green'
      });
      
      loadFiles(); // Refresh file list
    } catch (error) {
      console.error('Migration error:', error);
      frappe.msgprint('Error migrating files');
    } finally {
      setLoading(false);
    }
  };

  // Delete file
  const deleteFile = async (fileName) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await frappe.call({
        method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.delete_cloud_file',
        args: { cloud_file_name: fileName }
      });
      
      frappe.show_alert({
        message: 'File deleted successfully',
        indicator: 'green'
      });
      
      loadFiles();
    } catch (error) {
      console.error('Delete error:', error);
      frappe.msgprint('Error deleting file');
    }
  };

  // Filter files
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (file.tags && file.tags.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'all' || 
                       (filterType === 'images' && file.file_type && file.file_type.match(/\.(jpg|jpeg|png|gif)$/i)) ||
                       (filterType === 'documents' && file.file_type && file.file_type.match(/\.(pdf|doc|docx)$/i)) ||
                       (filterType === 'public' && file.is_public) ||
                       (filterType === 'private' && !file.is_public);
    
    return matchesSearch && matchesType;
  });

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (!fileType) return <File className="w-4 h-4" />;
    
    if (fileType.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return <Eye className="w-4 h-4 text-blue-500" />;
    } else if (fileType.match(/\.(pdf)$/i)) {
      return <File className="w-4 h-4 text-red-500" />;
    } else if (fileType.match(/\.(doc|docx)$/i)) {
      return <File className="w-4 h-4 text-blue-600" />;
    }
    
    return <File className="w-4 h-4" />;
  };

  return (
    <div className="cloud-file-manager p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cloud File Manager</h1>
        <p className="text-gray-600">Manage your files with cloud storage integration</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'upload', label: 'Upload Files', icon: Upload },
            { id: 'files', label: 'File Library', icon: Folder },
            { id: 'existing', label: 'Existing Files', icon: Search },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center px-1 py-4 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Upload Configuration */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Upload Configuration</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folder Path
                </label>
                <input
                  type="text"
                  value={uploadConfig.folder_path}
                  onChange={(e) => setUploadConfig({...uploadConfig, folder_path: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="public/files/products"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference DocType
                </label>
                <input
                  type="text"
                  value={uploadConfig.reference_doctype}
                  onChange={(e) => setUploadConfig({...uploadConfig, reference_doctype: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Item"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference Document
                </label>
                <input
                  type="text"
                  value={uploadConfig.reference_docname}
                  onChange={(e) => setUploadConfig({...uploadConfig, reference_docname: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ITEM-001"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  value={uploadConfig.tags}
                  onChange={(e) => setUploadConfig({...uploadConfig, tags: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="product, image, catalog"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={uploadConfig.description}
                onChange={(e) => setUploadConfig({...uploadConfig, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="File description..."
              />
            </div>
          </div>

          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Support for multiple files. Max 10MB per file.
            </p>
            
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            
            <label
              htmlFor="file-upload"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-2" />
              Select Files
            </label>
          </div>
        </div>
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Files</option>
                  <option value="images">Images</option>
                  <option value="documents">Documents</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                
                <button
                  onClick={loadFiles}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* File Grid */}
          <div className="bg-white rounded-lg border border-gray-200">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading files...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <File className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No files found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredFiles.map((file) => (
                  <div key={file.name} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getFileIcon(file.file_type)}
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {file.file_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(file.file_size)} • {file.folder_path}
                            {file.tags && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {file.tags}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {file.file_url && (
                          <button
                            onClick={() => window.open(file.file_url, '_blank')}
                            className="p-2 text-gray-400 hover:text-gray-600"
                            title="View File"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        
                        {file.s3_url && (
                          <button
                            onClick={() => window.open(file.s3_url, '_blank')}
                            className="p-2 text-gray-400 hover:text-blue-600"
                            title="View on S3"
                          >
                            <Cloud className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => deleteFile(file.name)}
                          className="p-2 text-gray-400 hover:text-red-600"
                          title="Delete File"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Files Tab */}
      {activeTab === 'existing' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Existing Files Management</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <button
                onClick={scanExistingFiles}
                disabled={loading}
                className="flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Search className="w-4 h-4 mr-2" />
                {loading ? 'Scanning...' : 'Scan Files'}
              </button>
              
              <button
                onClick={migrateFiles}
                disabled={loading || !scanResults}
                className="flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {loading ? 'Migrating...' : 'Migrate Files'}
              </button>
              
              <button
                onClick={() => {
                  frappe.call({
                    method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.existing_files_manager.cleanup_orphaned_records'
                  }).then(() => {
                    frappe.show_alert('Cleanup completed', 'green');
                    loadFiles();
                  });
                }}
                className="flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Cleanup Orphaned
              </button>
            </div>

            {/* Scan Results */}
            {scanResults && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-3">Scan Results</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {scanResults.total_files}
                    </div>
                    <div className="text-sm text-gray-500">Total Files</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {scanResults.untracked_files?.length || 0}
                    </div>
                    <div className="text-sm text-gray-500">Untracked</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {scanResults.orphaned_records?.length || 0}
                    </div>
                    <div className="text-sm text-gray-500">Orphaned</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {Object.keys(scanResults.files_by_folder || {}).length}
                    </div>
                    <div className="text-sm text-gray-500">Folders</div>
                  </div>
                </div>

                {scanResults.untracked_files?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-yellow-800 mb-2">
                      Untracked Files ({scanResults.untracked_files.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto">
                      {scanResults.untracked_files.slice(0, 10).map((file, index) => (
                        <div key={index} className="text-sm text-gray-600 py-1">
                          {file.name} ({formatFileSize(file.size)})
                        </div>
                      ))}
                      {scanResults.untracked_files.length > 10 && (
                        <div className="text-sm text-gray-500 py-1">
                          ... and {scanResults.untracked_files.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Migration Configuration */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Migration Settings</h3>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={migrationConfig.auto_organize}
                  onChange={(e) => setMigrationConfig({
                    ...migrationConfig,
                    auto_organize: e.target.checked
                  })}
                  className="mr-2"
                />
                Auto-organize files by type
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={migrationConfig.create_cloud_records}
                  onChange={(e) => setMigrationConfig({
                    ...migrationConfig,
                    create_cloud_records: e.target.checked
                  })}
                  className="mr-2"
                />
                Create Cloud File records for untracked files
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <File className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Files</p>
                  <p className="text-2xl font-bold text-gray-900">{files.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <Cloud className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Cloud Files</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {files.filter(f => f.s3_url).length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <Eye className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Public Files</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {files.filter(f => f.is_public).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Files */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">Recent Files</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {files.slice(0, 5).map((file) => (
                <div key={file.name} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(file.file_type)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {file.file_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {file.folder_path}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-505">
                      {new Date(file.creation).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
