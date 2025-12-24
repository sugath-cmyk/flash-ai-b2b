import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from '../lib/axios';

interface Document {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'failed';
  analysis_result?: {
    summary: string;
    keyPoints: string[];
    sentiment?: string;
    entities?: string[];
  };
  analyzed_at?: string;
  error_message?: string;
  created_at: string;
}

export default function Documents() {
  const { user, logout } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await axios.get('/documents');
      setDocuments(response.data.data.documents);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('analyze', 'true');

      const response = await axios.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await loadDocuments();
      alert('Document uploaded successfully! Analysis in progress...');
    } catch (error: any) {
      console.error('Failed to upload document:', error);
      alert(error.response?.data?.error?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const analyzeDocument = async (id: string) => {
    setAnalyzing(true);

    try {
      await axios.post(`/documents/${id}/analyze`);
      await loadDocuments();
      alert('Document analysis started!');
    } catch (error: any) {
      console.error('Failed to analyze document:', error);
      alert(error.response?.data?.error?.message || 'Failed to analyze document');
    } finally {
      setAnalyzing(false);
    }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await axios.delete(`/documents/${id}`);
      setDocuments(prev => prev.filter(d => d.id !== id));
      if (selectedDocument?.id === id) {
        setSelectedDocument(null);
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const downloadDocument = (id: string) => {
    window.open(`${axios.defaults.baseURL}/documents/${id}/download`, '_blank');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded': return 'bg-blue-100 text-blue-800';
      case 'analyzing': return 'bg-yellow-100 text-yellow-800';
      case 'analyzed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            </div>
            <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h2>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? 'Uploading...' : 'Choose File'}
            </button>
            <p className="text-sm text-gray-600">
              Supported formats: PDF, DOC, DOCX, TXT, CSV, XLSX, XLS (Max 10MB)
            </p>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Document List */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Documents</h2>
            <div className="space-y-3">
              {documents.length === 0 && (
                <div className="card text-center py-8">
                  <p className="text-gray-500">No documents uploaded yet</p>
                </div>
              )}

              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`card cursor-pointer hover:shadow-lg transition-shadow ${
                    selectedDocument?.id === doc.id ? 'ring-2 ring-primary-500' : ''
                  }`}
                  onClick={() => setSelectedDocument(doc)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {doc.original_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(doc.size)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadDocument(doc.id);
                        }}
                        className="text-gray-400 hover:text-blue-600"
                        title="Download"
                      >
                        ↓
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDocument(doc.id);
                        }}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Document Details */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Analysis</h2>
            {!selectedDocument ? (
              <div className="card text-center py-12">
                <p className="text-gray-500">Select a document to view analysis</p>
              </div>
            ) : (
              <div className="card">
                <h3 className="text-md font-semibold text-gray-900 mb-4">
                  {selectedDocument.original_name}
                </h3>

                {selectedDocument.status === 'uploaded' && (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">Document not yet analyzed</p>
                    <button
                      onClick={() => analyzeDocument(selectedDocument.id)}
                      disabled={analyzing}
                      className="btn-primary"
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze Document'}
                    </button>
                  </div>
                )}

                {selectedDocument.status === 'analyzing' && (
                  <div className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <p className="text-gray-600">Analyzing document...</p>
                  </div>
                )}

                {selectedDocument.status === 'failed' && (
                  <div className="text-center py-8">
                    <p className="text-red-600 mb-2">Analysis failed</p>
                    <p className="text-sm text-gray-500">{selectedDocument.error_message}</p>
                  </div>
                )}

                {selectedDocument.status === 'analyzed' && selectedDocument.analysis_result && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Summary</h4>
                      <p className="text-sm text-gray-600">{selectedDocument.analysis_result.summary}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Points</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedDocument.analysis_result.keyPoints.map((point, idx) => (
                          <li key={idx} className="text-sm text-gray-600">{point}</li>
                        ))}
                      </ul>
                    </div>

                    {selectedDocument.analysis_result.sentiment && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Sentiment</h4>
                        <p className="text-sm text-gray-600 capitalize">{selectedDocument.analysis_result.sentiment}</p>
                      </div>
                    )}

                    {selectedDocument.analysis_result.entities && selectedDocument.analysis_result.entities.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Entities</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedDocument.analysis_result.entities.map((entity, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              {entity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
