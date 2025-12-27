import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../lib/axios';

interface ConnectionStatus {
  connected: boolean;
  shopDomain?: string;
  scopes: string[];
  installedAt?: string;
  syncStatus: string;
  lastSync?: string;
  autoSyncEnabled: boolean;
  syncFrequency: string;
}

interface SyncStatus {
  syncStatus: string;
  lastSync?: string;
  latestJob?: {
    id: string;
    status: string;
    progress: number;
    totalItems: number;
    itemsProcessed: number;
    startedAt: string;
    completedAt?: string;
    errorMessage?: string;
  };
  counts: {
    products: number;
    collections: number;
    pages: number;
  };
}

interface SyncHistoryItem {
  id: string;
  job_type: string;
  status: string;
  progress: number;
  total_items: number;
  items_processed: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
}

const StoreManagement: React.FC = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [setupingWebhooks, setSetupingWebhooks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-refresh sync status every 5 seconds when syncing
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (syncStatus?.latestJob?.status === 'processing') {
      interval = setInterval(() => {
        fetchSyncStatus();
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [syncStatus?.latestJob?.status]);

  useEffect(() => {
    fetchData();
  }, [storeId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchConnectionStatus(),
        fetchSyncStatus(),
        fetchSyncHistory(),
      ]);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConnectionStatus = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/shopify/stores/${storeId}/status`
      );
      setConnectionStatus(response.data.data);
    } catch (err: any) {
      console.error('Error fetching connection status:', err);
      if (err.response?.status === 404) {
        setError('Store not found');
      }
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/shopify/stores/${storeId}/sync/status`,
        {
        }
      );
      setSyncStatus(response.data.data);
    } catch (err: any) {
      console.error('Error fetching sync status:', err);
    }
  };

  const fetchSyncHistory = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/shopify/stores/${storeId}/sync/history?limit=10`,
        {
        }
      );
      setSyncHistory(response.data.data);
    } catch (err: any) {
      console.error('Error fetching sync history:', err);
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);

      await axios.post(
        `http://localhost:3000/api/shopify/stores/${storeId}/sync`,
        {},
        {
        }
      );

      setSuccess('Sync started successfully! Data will be imported in the background.');

      // Refresh status after a moment
      setTimeout(() => {
        fetchSyncStatus();
        fetchSyncHistory();
      }, 2000);
    } catch (err: any) {
      console.error('Error triggering sync:', err);
      setError(err.response?.data?.message || 'Failed to start sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleSetupWebhooks = async () => {
    try {
      setSetupingWebhooks(true);
      setError(null);
      setSuccess(null);

      await axios.post(
        `http://localhost:3000/api/shopify/stores/${storeId}/webhooks`,
        {},
        {
        }
      );

      setSuccess('Webhooks configured successfully! Real-time sync is now enabled.');
    } catch (err: any) {
      console.error('Error setting up webhooks:', err);
      setError(err.response?.data?.message || 'Failed to setup webhooks');
    } finally {
      setSetupingWebhooks(false);
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    try {
      setError(null);
      await axios.patch(
        `http://localhost:3000/api/shopify/stores/${storeId}/auto-sync`,
        { enabled },
        {
        }
      );

      setConnectionStatus((prev) =>
        prev ? { ...prev, autoSyncEnabled: enabled } : null
      );
      setSuccess(`Auto-sync ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (err: any) {
      console.error('Error toggling auto-sync:', err);
      setError(err.response?.data?.message || 'Failed to update auto-sync');
    }
  };

  const handleChangeSyncFrequency = async (frequency: string) => {
    try {
      setError(null);
      await axios.patch(
        `http://localhost:3000/api/shopify/stores/${storeId}/auto-sync`,
        { frequency },
        {
        }
      );

      setConnectionStatus((prev) =>
        prev ? { ...prev, syncFrequency: frequency } : null
      );
      setSuccess(`Sync frequency updated to ${frequency}`);
    } catch (err: any) {
      console.error('Error changing sync frequency:', err);
      setError(err.response?.data?.message || 'Failed to update sync frequency');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this Shopify store? This will stop data syncing.')) {
      return;
    }

    try {
      setError(null);
      await axios.delete(
        `http://localhost:3000/api/shopify/stores/${storeId}`,
        {
        }
      );

      setSuccess('Store disconnected successfully');
      setTimeout(() => {
        navigate(`/brand/${storeId}`);
      }, 2000);
    } catch (err: any) {
      console.error('Error disconnecting store:', err);
      setError(err.response?.data?.message || 'Failed to disconnect store');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      disconnected: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${styles[status] || styles.pending}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-emerald-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-600">Loading store management...</p>
        </div>
      </div>
    );
  }

  if (!connectionStatus?.connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Not Connected</h2>
          <p className="text-gray-600 mb-6">
            This store is not connected to Shopify. Please connect it first to manage syncing.
          </p>
          <button
            onClick={() => navigate('/brand/connect-store')}
            className="btn-primary w-full"
          >
            Connect Shopify Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate(`/brand/${storeId}`)}
                className="text-white/80 hover:text-white mb-2 flex items-center text-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold">Store Management</h1>
              <p className="text-emerald-100 mt-1">{connectionStatus.shopDomain}</p>
            </div>
            <div className="flex items-center space-x-3">
              {getStatusBadge(connectionStatus.syncStatus)}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-800 font-medium">{success}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 font-medium">{error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Statistics Cards */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Products</h3>
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900">{syncStatus?.counts.products || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total products imported</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Collections</h3>
              <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900">{syncStatus?.counts.collections || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total collections imported</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Pages</h3>
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900">{syncStatus?.counts.pages || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total pages imported</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Sync Status Card */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Status
            </h2>

            {syncStatus?.latestJob && syncStatus.latestJob.status === 'processing' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Progress</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {syncStatus.latestJob.progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${syncStatus.latestJob.progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">
                  Processing: {syncStatus.latestJob.itemsProcessed} / {syncStatus.latestJob.totalItems} items
                </p>
                <div className="flex items-center text-sm text-blue-600">
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Syncing in progress...
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Last Sync</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatRelativeTime(connectionStatus.lastSync)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Status</span>
                  {getStatusBadge(connectionStatus.syncStatus)}
                </div>
                <button
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="w-full btn-primary flex items-center justify-center"
                >
                  {syncing ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Starting Sync...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync Now
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Auto-Sync Settings Card */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </h2>

            <div className="space-y-4">
              {/* Auto-Sync Toggle */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">Auto-Sync</p>
                  <p className="text-xs text-gray-500">Automatically sync data periodically</p>
                </div>
                <button
                  onClick={() => handleToggleAutoSync(!connectionStatus.autoSyncEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    connectionStatus.autoSyncEnabled ? 'bg-emerald-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      connectionStatus.autoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Sync Frequency */}
              {connectionStatus.autoSyncEnabled && (
                <div className="py-3 border-b border-gray-100">
                  <label className="text-sm font-medium text-gray-900 block mb-2">
                    Sync Frequency
                  </label>
                  <select
                    value={connectionStatus.syncFrequency}
                    onChange={(e) => handleChangeSyncFrequency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              )}

              {/* Webhooks */}
              <div className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Real-time Webhooks</p>
                    <p className="text-xs text-gray-500">Get instant updates from Shopify</p>
                  </div>
                </div>
                <button
                  onClick={handleSetupWebhooks}
                  disabled={setupingWebhooks}
                  className="w-full btn-outline text-sm py-2"
                >
                  {setupingWebhooks ? 'Setting up...' : 'Setup Webhooks'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sync History Table */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Sync History
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Started</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {syncHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No sync history yet. Run your first sync to see results here.
                    </td>
                  </tr>
                ) : (
                  syncHistory.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 capitalize">{job.job_type}</td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(job.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-200 rounded-full h-1.5 mr-2">
                            <div
                              className="bg-emerald-600 h-1.5 rounded-full"
                              style={{ width: `${job.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-gray-600">{job.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {job.items_processed} / {job.total_items || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatRelativeTime(job.started_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {job.completed_at
                          ? `${Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s`
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-red-200 mt-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Danger Zone
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Disconnecting your Shopify store will stop all data syncing and remove the connection.
          </p>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Disconnect Shopify Store
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreManagement;
