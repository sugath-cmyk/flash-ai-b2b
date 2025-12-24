import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from '../lib/axios';

interface Store {
  id: string;
  platform: string;
  store_url: string;
  store_name: string;
  domain: string;
  sync_status: string;
  last_sync: string | null;
  product_count: number;
  collection_count: number;
  page_count: number;
  created_at: string;
}

interface ExtractionJob {
  id: string;
  status: string;
  progress: number;
  error_message: string | null;
}

export default function Stores() {
  const { user } = useAuthStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importForm, setImportForm] = useState({
    storeUrl: '',
    accessToken: '',
    apiKey: '',
    apiSecret: '',
  });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<ExtractionJob | null>(null);

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (pollingJobId) {
      const interval = setInterval(() => {
        pollJobStatus(pollingJobId);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [pollingJobId]);

  const loadStores = async () => {
    try {
      const response = await axios.get('/stores');
      setStores(response.data.data);
    } catch (error: any) {
      console.error('Failed to load stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await axios.get(`/stores/jobs/${jobId}`);
      const job = response.data.data;
      setJobStatus(job);

      if (job.status === 'completed' || job.status === 'failed') {
        setPollingJobId(null);
        loadStores(); // Refresh store list
      }
    } catch (error) {
      console.error('Failed to poll job status:', error);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportSuccess(false);
    setImporting(true);

    try {
      const response = await axios.post('/stores/extract', importForm);
      const { jobId, storeId } = response.data.data;

      setImportSuccess(true);
      setPollingJobId(jobId);

      // Reset form
      setImportForm({
        storeUrl: '',
        accessToken: '',
        apiKey: '',
        apiSecret: '',
      });

      // Close modal after 1 second
      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccess(false);
      }, 1000);
    } catch (error: any) {
      setImportError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to import store. Please check your credentials and try again.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteStore = async (storeId: string) => {
    if (!confirm('Are you sure you want to delete this store? All extracted data will be removed.')) {
      return;
    }

    try {
      await axios.delete(`/stores/${storeId}`);
      loadStores();
    } catch (error: any) {
      alert('Failed to delete store: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  const handleRetryExtraction = async (storeId: string) => {
    try {
      const response = await axios.post(`/stores/${storeId}/retry`);
      const { jobId } = response.data.data;
      setPollingJobId(jobId);
      loadStores();
    } catch (error: any) {
      alert('Failed to retry extraction: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'shopify': return 'bg-green-100 text-green-800';
      case 'woocommerce': return 'bg-purple-100 text-purple-800';
      case 'bigcommerce': return 'bg-blue-100 text-blue-800';
      case 'magento': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 mb-1 block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Store Import</h1>
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="btn btn-primary"
            >
              Import New Store
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Job Status Banner */}
        {jobStatus && jobStatus.status !== 'completed' && jobStatus.status !== 'failed' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Extracting Store Data</h3>
                  <p className="text-sm text-gray-600">{jobStatus.error_message || 'Processing...'}</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-blue-600">{jobStatus.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${jobStatus.progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Stores List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading stores...</p>
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No stores imported yet</h3>
            <p className="mt-2 text-gray-600">
              Import your first e-commerce store to get started.
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="btn btn-primary mt-6"
            >
              Import Your First Store
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {stores.map((store) => (
              <div key={store.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {store.store_name || store.domain}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPlatformColor(store.platform)}`}>
                        {store.platform}
                      </span>
                    </div>
                    <a
                      href={store.store_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-primary-600"
                    >
                      {store.store_url}
                    </a>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(store.sync_status)}`}>
                    {store.sync_status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-t border-b border-gray-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{store.product_count}</div>
                    <div className="text-xs text-gray-600">Products</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{store.collection_count}</div>
                    <div className="text-xs text-gray-600">Collections</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{store.page_count}</div>
                    <div className="text-xs text-gray-600">Pages</div>
                  </div>
                </div>

                {store.last_sync && (
                  <p className="text-sm text-gray-600 mb-4">
                    Last synced: {new Date(store.last_sync).toLocaleString()}
                  </p>
                )}

                <div className="flex gap-2">
                  <Link
                    to={`/stores/${store.id}`}
                    className="btn btn-secondary flex-1 text-center"
                  >
                    View Details
                  </Link>
                  {store.sync_status === 'failed' && (
                    <button
                      onClick={() => handleRetryExtraction(store.id)}
                      className="btn btn-primary"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteStore(store.id)}
                    className="btn btn-secondary text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Import Store</h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleImport} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store URL *
                  </label>
                  <input
                    type="url"
                    required
                    className="input"
                    placeholder="https://your-store.myshopify.com"
                    value={importForm.storeUrl}
                    onChange={(e) => setImportForm({ ...importForm, storeUrl: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your Shopify, WooCommerce, or other e-commerce store URL
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Token (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="shpat_..."
                    value={importForm.accessToken}
                    onChange={(e) => setImportForm({ ...importForm, accessToken: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    For private stores, provide your Shopify Admin API access token
                  </p>
                </div>

                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-700 font-medium mb-2">
                    Advanced: API Key & Secret (Optional)
                  </summary>
                  <div className="space-y-3 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="text"
                        className="input text-sm"
                        value={importForm.apiKey}
                        onChange={(e) => setImportForm({ ...importForm, apiKey: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        API Secret
                      </label>
                      <input
                        type="password"
                        className="input text-sm"
                        value={importForm.apiSecret}
                        onChange={(e) => setImportForm({ ...importForm, apiSecret: e.target.value })}
                      />
                    </div>
                  </div>
                </details>

                {importError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    Store import started! Extraction is now running in the background.
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="btn btn-secondary flex-1"
                    disabled={importing}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary flex-1"
                    disabled={importing}
                  >
                    {importing ? 'Importing...' : 'Import Store'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
