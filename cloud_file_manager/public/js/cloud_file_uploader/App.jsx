import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Clock,
  X
} from 'lucide-react';

// Error Boundary Component
class CloudFileErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Cloud File Manager Error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Report error to Frappe
    if (window.frappe && frappe.show_alert) {
      frappe.show_alert({
        message: 'An error occurred in the file manager. Please refresh the page.',
        indicator: 'red'
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback p-6 text-center border-2 border-red-200 bg-red-50 rounded-lg">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
          <p className="text-red-600 mb-4">
            The file manager encountered an error. Please refresh the page and try again.
          </p>
          <div className="space-x-2">
            <button 
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            >
              Try Again
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-600">Error Details</summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// File Upload Manager Class for resource management
class FileUploadManager {
  constructor() {
    this.activeReaders = new Set();
    this.abortControllers = new Set();
  }

  async readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      this.activeReaders.add(reader);

      reader.onload = () => {
        this.activeReaders.delete(reader);
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };

      reader.onerror = () => {
        this.activeReaders.delete(reader);
        reject(new Error('File reading failed'));
      };

      // Add timeout for large files
      const timeout = setTimeout(() => {
        if (this.activeReaders.has(reader)) {
          reader.abort();
          this.activeReaders.delete(reader);
          reject(new Error('File reading timeout'));
        }
      }, 30000); // 30 second timeout

      reader.onloadend = () => clearTimeout(timeout);
      reader.readAsDataURL(file);
    });
  }

  createAbortController() {
    const controller = new AbortController();
    this.abortControllers.add(controller);
    return controller;
  }

  cleanup() {
    // Abort active file readers
    this.activeReaders.forEach(reader => {
      if (reader.readyState === FileReader.LOADING) {
        reader.abort();
      }
    });
    this.activeReaders.clear();

    // Abort active requests
    this.abortControllers.forEach(controller => {
      controller.abort();
    });
    this.abortControllers.clear();
  }
}

// Main App Component
const App = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState(null);

  // File upload manager instance
  const [uploadManager] = useState(() => new FileUploadManager());

  // File upload states
  const [uploadConfig, setUploadConfig] = useState(() => {
    // Load from localStorage with defaults
    const saved = localStorage.getItem('cloud_file_upload_config');
    return saved ? JSON.parse(saved) : {
      folder_path: 'public/files/products',
      reference_doctype: '',
      reference_docname: '',
      description: '',
      tags: ''
    };
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

  // Save upload config to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('cloud_file_upload_config', JSON.stringify(uploadConfig));
  }, [uploadConfig]);

  // Load files on component mount
  useEffect(() => {
    loadFiles();
    
    // Cleanup on unmount
    return () => {
      uploadManager.cleanup();
    };
  }, []);

  // Error handling helper
  const handleError = useCallback((error, context = '') => {
    console.error(`Error in ${context}:`, error);
    setError(`${context}: ${error.message || 'An unexpected error occurred'}`);
    
    if (window.frappe && frappe.show_alert) {
      frappe.show_alert({
        message: `Error ${context}: ${error.message || 'Unknown error'}`,
        indicator: 'red'
      });
    }
  }, []);

  // Clear error after some time
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const abortController = uploadManager.createAbortController();
      
      const response = await frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Cloud File',
          fields: ['*'],
          limit_page_length: 100,
          order_by: 'creation desc'
        },
        signal: abortController.signal
      });
      
      setFiles(response.message || []);
    } catch (error) {
      if (error.name !== 'AbortError') {
        handleError(error, 'loading files');
      }
    } finally {
      setLoading(false);
    }
  }, [handleError, uploadManager]);

  // Memoized filtered files for performance
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      const matchesSearch = !searchTerm || 
        file.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.tags?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || 
        (filterType === 'images' && file.file_type?.match(/\.(jpg|jpeg|png|gif)$/i)) ||
        (filterType === 'documents' && file.file_type?.match(/\.(pdf|doc|docx)$/i)) ||
        (filterType === 'public' && file.is_public) ||
        (filterType === 'private' && !file.is_public);
      
      return matchesSearch && matchesType;
    });
  }, [files, searchTerm, filterType]);

  // File validation
  const validateFile = useCallback((file) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt'];
    
    if (file.size > maxSize) {
      throw new Error(`File ${file.name} exceeds 10MB limit`);
    }
    
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(extension)) {
      throw new Error(`File type ${extension} is not allowed`);
    }
    
    return true;
  }, []);

  // File upload handlers with improved error handling
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileUpload(droppedFiles);
  }, [uploadConfig]);

  const handleFileSelect = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFileUpload(selectedFiles);
  }, [uploadConfig]);

  const handleFileUpload = useCallback(async (fileList) => {
    if (fileList.length === 0) return;

    setLoading(true);
    setError(null);
    
    try {
      // Validate all files first
      for (const file of fileList) {
        validateFile(file);
      }

      const uploadPromises = fileList.map(async (file, index) => {
        try {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'reading', progress: 0 }
          }));

          const fileContent = await uploadManager.readFileAsBase64(file);
          
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'uploading', progress: 50 }
          }));

          const response = await frappe.call({
            method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.upload_file_to_products',
            args: {
              file_content: fileContent,
              filename: file.name,
              folder_path: uploadConfig.folder_path,
              reference_doctype: uploadConfig.reference_doctype,
              reference_docname: uploadConfig.reference_docname,
              description: uploadConfig.description,
              tags: uploadConfig.tags
            }
          });

          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'complete', progress: 100 }
          }));

          return { success: true, result: response.message, filename: file.name };
        } catch (error) {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'error', progress: 0, error: error.message }
          }));
          
          return { success: false, error: error.message, filename: file.name };
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      
      if (window.frappe && frappe.show_alert) {
        frappe.show_alert({
          message: `Successfully uploaded ${successCount} out of ${fileList.length} files`,
          indicator: successCount === fileList.length ? 'green' : 'orange'
        });
      }
      
      // Clear upload progress after delay
      setTimeout(() => setUploadProgress({}), 3000);
      
      loadFiles(); // Refresh file list
    } catch (error) {
      handleError(error, 'uploading files');
    } finally {
      setLoading(false);
    }
  }, [uploadConfig, validateFile, uploadManager, handleError, loadFiles]);

  // Scan existing files with improved error handling
  const scanExistingFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    
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
      handleError(error, 'scanning files');
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // Migrate existing files
  const migrateFiles = useCallback(async () => {
    if (!scanResults) {
      setError('Please run a scan first');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await frappe.call({
        method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.existing_files_manager.migrate_existing_files',
        args: {
          migration_config: migrationConfig
        }
      });
      
      if (window.frappe && frappe.show_alert) {
        frappe.show_alert({
          message: `Migration completed: ${response.message?.migrated_files || 0} files processed`,
          indicator: 'green'
        });
      }
      
      loadFiles(); // Refresh file list
    } catch (error) {
      handleError(error, 'migrating files');
    } finally {
      setLoading(false);
    }
  }, [scanResults, migrationConfig, handleError, loadFiles]);

  // Delete file with confirmation
  const deleteFile = useCallback(async (fileName) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      await frappe.call({
        method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.delete_cloud_file',
        args: { cloud_file_name: fileName }
      });
      
      if (window.frappe && frappe.show_alert) {
        frappe.show_alert({
          message: 'File deleted successfully',
          indicator: 'green'
        });
      }
      
      loadFiles();
    } catch (error) {
      handleError(error, 'deleting file');
    }
  }, [handleError, loadFiles]);

  // Utility functions
  const formatFileSize = useCallback((bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const getFileIcon = useCallback((fileType) => {
    if (!fileType) return <File className="w-4 h-4" />;
    
    if (fileType.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return <Eye className="w-4 h-4 text-blue-500" />;
    } else if (fileType.match(/\.(pdf)$/i)) {
      return <File className="w-4 h-4 text-red-500" />;
    } else if (fileType.match(/\.(doc|docx)$/i)) {
      return <File className="w-4 h-4 text-blue-600" />;
    }
    
    return <File className="w-4 h-4" />;
  }, []);

  // Component render optimization
  const renderUploadProgress = useMemo(() => {
    const progressEntries = Object.entries(uploadProgress);
    if (progressEntries.length === 0) return null;

    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 mt-4">
        <h4 className="font-medium mb-3">Upload Progress</h4>
        <div className="space-y-2">
          {progressEntries.map(([filename, progress]) => (
            <div key={filename} className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{filename}</span>
                  <span className="text-gray-500">{progress.status}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      progress.status === 'error' ? 'bg-red-500' :
                      progress.status === 'complete' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
                {progress.error && (
                  <p className="text-red-500 text-xs mt-1">{progress.error}</p>
                )}
              </div>
              {progress.status === 'complete' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {progress.status === 'error' && (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }, [uploadProgress]);

  return (
    <CloudFileErrorBoundary>
      <div className="cloud-file-manager p-6 max-w-7xl mx-auto">
        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
                className={`flex items-center px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
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
                accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt"
              />
              
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Select Files
              </label>
            </div>

            {/* Upload Progress */}
            {renderUploadProgress}
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
                    disabled={loading}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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
                    <div key={file.name} className="p-4 hover:bg-gray-50 transition-colors">
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
                              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                              title="View File"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          
                          {file.s3_url && (
                            <button
                              onClick={() => window.open(file.s3_url, '_blank')}
                              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="View on S3"
                            >
                              <Cloud className="w-4 h-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => deleteFile(file.name)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
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
                  className="flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Scanning...' : 'Scan Files'}
                </button>
                
                <button
                  onClick={migrateFiles}
                  disabled={loading || !scanResults}
                  className="flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {loading ? 'Migrating...' : 'Migrate Files'}
                </button>
                
                <button
                  onClick={() => {
                    frappe.call({
                      method: 'cloud_file_manager.cloud_file_manager.doctype.cloud_file.cloud_file.cleanup_orphaned_files'
                    }).then(() => {
                      frappe.show_alert('Cleanup completed', 'green');
                      loadFiles();
                    });
                  }}
                  className="flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
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
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {scanResults.untracked_files.slice(0, 10).map((file, index) => (
                          <div key={index} className="text-sm text-gray-600 py-1 px-2 bg-white rounded">
                            {file.name} ({formatFileSize(file.size)})
                          </div>
                        ))}
                        {scanResults.untracked_files.length > 10 && (
                          <div className="text-sm text-gray-500 py-1 px-2">
                            ... and {scanResults.untracked_files.length - 10} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                      <div className="text-sm text-gray-500">
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
    </CloudFileErrorBoundary>
  );
};

export default App;