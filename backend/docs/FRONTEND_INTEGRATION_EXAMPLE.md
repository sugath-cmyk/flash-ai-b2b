# Frontend Integration Example

Example React/TypeScript code for integrating the Brand Store Connection API.

## Store Connection Form Component

```typescript
import React, { useState } from 'react';
import axios from 'axios';

interface StoreConnectionFormProps {
  authToken: string;
  onSuccess: (storeId: string) => void;
}

export const StoreConnectionForm: React.FC<StoreConnectionFormProps> = ({
  authToken,
  onSuccess,
}) => {
  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  const API_BASE_URL = 'https://your-api.com/api';

  // Test connection before saving
  const handleTestConnection = async () => {
    setTestLoading(true);
    setError('');
    setTestResult(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/brand/stores/test-connection`,
        {
          shopDomain: shopDomain.trim(),
          accessToken: accessToken.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setTestResult(response.data.data);
      alert(`✅ Connection successful!\n\nStore: ${response.data.data.storeName}\nProducts: ${response.data.data.productCount}`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Connection test failed';
      const hint = err.response?.data?.hint;
      setError(hint ? `${errorMsg}\n${hint}` : errorMsg);
    } finally {
      setTestLoading(false);
    }
  };

  // Connect store and start sync
  const handleConnect = async () => {
    if (!shopDomain || !accessToken) {
      setError('Please provide both shop domain and access token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/brand/stores/connect`,
        {
          shopDomain: shopDomain.trim(),
          accessToken: accessToken.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { storeId, storeName, syncStatus } = response.data.data;

      alert(`✅ ${storeName} connected successfully!\n\nSync Status: ${syncStatus}\nStore ID: ${storeId}`);

      // Redirect to dashboard or sync status page
      onSuccess(storeId);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to connect store';
      const hint = err.response?.data?.hint;
      setError(hint ? `${errorMsg}\n\n${hint}` : errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="store-connection-form">
      <h2>Connect Your Shopify Store</h2>

      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {testResult && (
        <div className="test-result" style={{ background: '#e8f5e9', padding: '16px', marginBottom: '16px', borderRadius: '8px' }}>
          <h4>✅ Connection Test Passed</h4>
          <p><strong>Store:</strong> {testResult.storeName}</p>
          <p><strong>Domain:</strong> {testResult.domain}</p>
          <p><strong>Products:</strong> {testResult.productCount}</p>
          <p><strong>Country:</strong> {testResult.country}</p>
        </div>
      )}

      <div className="form-group">
        <label>Shop Domain *</label>
        <input
          type="text"
          placeholder="mystore.myshopify.com"
          value={shopDomain}
          onChange={(e) => setShopDomain(e.target.value)}
          disabled={loading || testLoading}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <small style={{ color: '#666' }}>
          Your Shopify domain (e.g., mystore.myshopify.com)
        </small>
      </div>

      <div className="form-group">
        <label>Admin API Access Token *</label>
        <input
          type="password"
          placeholder="shpat_xxxxxxxxxxxxxxxxxxxxx"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          disabled={loading || testLoading}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <small style={{ color: '#666' }}>
          Get this from Shopify Admin → Settings → Apps → Develop apps
        </small>
      </div>

      <div className="button-group" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button
          onClick={handleTestConnection}
          disabled={!shopDomain || !accessToken || testLoading || loading}
          style={{
            padding: '12px 24px',
            background: '#fff',
            color: '#667eea',
            border: '2px solid #667eea',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          {testLoading ? 'Testing...' : 'Test Connection'}
        </button>

        <button
          onClick={handleConnect}
          disabled={!shopDomain || !accessToken || loading || testLoading}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          {loading ? 'Connecting...' : 'Connect Store'}
        </button>
      </div>

      <div className="help-text" style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h4>How to get your credentials:</h4>
        <ol style={{ paddingLeft: '20px' }}>
          <li>Go to Shopify Admin → Settings → Apps and sales channels</li>
          <li>Click "Develop apps" → "Create an app"</li>
          <li>Configure scopes: read_products, read_collections, read_content</li>
          <li>Install app and copy the Admin API access token</li>
        </ol>
        <a href="/docs/shopify-setup" style={{ color: '#667eea' }}>
          View detailed guide →
        </a>
      </div>
    </div>
  );
};
```

## Sync Status Component

```typescript
import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface SyncStatusProps {
  storeId: string;
  authToken: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ storeId, authToken }) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = 'https://your-api.com/api';

  const fetchStatus = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/brand/stores/${storeId}/connection`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      setStatus(response.data.data);
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Poll every 5 seconds if sync is in progress
    const interval = setInterval(() => {
      if (status?.syncStatus === 'processing') {
        fetchStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [storeId, status?.syncStatus]);

  if (loading) {
    return <div>Loading sync status...</div>;
  }

  if (!status) {
    return <div>Failed to load sync status</div>;
  }

  const getSyncStatusColor = (syncStatus: string) => {
    switch (syncStatus) {
      case 'completed':
        return '#4caf50';
      case 'processing':
        return '#2196f3';
      case 'failed':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  return (
    <div className="sync-status" style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
      <h3>{status.storeName}</h3>
      <p style={{ color: '#666' }}>{status.domain}</p>

      <div style={{ marginTop: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: getSyncStatusColor(status.syncStatus),
            }}
          />
          <strong>Status:</strong> {status.syncStatus}
        </div>

        {status.latestSyncJob && (
          <div style={{ marginTop: '16px', background: '#f5f5f5', padding: '12px', borderRadius: '6px' }}>
            <p><strong>Progress:</strong> {status.latestSyncJob.progress}%</p>
            <p><strong>Items Processed:</strong> {status.latestSyncJob.itemsProcessed} / {status.latestSyncJob.totalItems}</p>
            {status.latestSyncJob.errorMessage && (
              <p style={{ color: 'red' }}>
                <strong>Error:</strong> {status.latestSyncJob.errorMessage}
              </p>
            )}
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <p><strong>Products:</strong> {status.productCount}</p>
          <p><strong>Collections:</strong> {status.collectionCount}</p>
          {status.lastSync && (
            <p><strong>Last Sync:</strong> {new Date(status.lastSync).toLocaleString()}</p>
          )}
        </div>

        {status.isSynced && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#e8f5e9',
            borderRadius: '6px',
            color: '#2e7d32',
          }}>
            ✅ Your store is fully synced! The AI widget is ready to answer customer questions.
          </div>
        )}
      </div>
    </div>
  );
};
```

## Using with React Router

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreConnectionForm } from './components/StoreConnectionForm';
import { SyncStatus } from './components/SyncStatus';

function App() {
  const authToken = 'YOUR_JWT_TOKEN'; // Get from your auth system

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/connect-store"
          element={
            <StoreConnectionForm
              authToken={authToken}
              onSuccess={(storeId) => {
                window.location.href = `/stores/${storeId}/sync-status`;
              }}
            />
          }
        />
        <Route
          path="/stores/:storeId/sync-status"
          element={
            <SyncStatus
              storeId={window.location.pathname.split('/')[2]}
              authToken={authToken}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

## Axios Instance Setup

```typescript
// api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://your-api.com/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

## TypeScript Types

```typescript
// types/store.ts
export interface ShopifyCredentials {
  shopDomain: string;
  accessToken: string;
}

export interface StoreConnectionResponse {
  success: boolean;
  message: string;
  data: {
    storeId: string;
    storeName: string;
    domain: string;
    isNewStore: boolean;
    syncStatus: 'pending' | 'processing' | 'completed' | 'failed';
    shopInfo: {
      email: string;
      currency: string;
      country: string;
      productCount: number;
    };
  };
}

export interface ConnectionStatus {
  storeId: string;
  storeName: string;
  domain: string;
  isConnected: boolean;
  isSynced: boolean;
  syncStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'disconnected';
  lastSync: string | null;
  productCount: number;
  collectionCount: number;
  latestSyncJob: {
    status: string;
    progress: number;
    totalItems: number;
    itemsProcessed: number;
    startedAt: string;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
}
```

This provides a complete frontend integration example for brand owners to connect their Shopify stores!
