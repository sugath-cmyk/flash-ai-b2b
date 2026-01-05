import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from '../lib/axios';
import AdminAnalytics from '../components/AdminAnalytics';
import Conversations from '../components/Conversations';

interface Analytics {
  eventCounts: Array<{ event_type: string; count: string }>;
  dailySessions: Array<{ date: string; sessions: string }>;
  uniqueVisitors: number;
  conversationStats: {
    total_conversations: string;
    resolved_conversations: string;
    avg_resolution_time: string;
  };
}

interface Subscription {
  plan_name: string;
  plan_interval: string;
  amount: number;
  status: string;
  current_period_end: string;
  message_limit: number;
  messages_used: number;
}

interface ShopifyConnectionStatus {
  connected: boolean;
  shopDomain?: string;
  syncStatus?: string;
  lastSync?: string;
}

export default function BrandDashboard() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'widget' | 'analytics' | 'conversations' | 'query-analytics' | 'billing'>('overview');
  const [store, setStore] = useState<any>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyConnectionStatus | null>(null);
  const [embedCode, setEmbedCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (storeId) {
      loadData();
    }
  }, [storeId]);

  const loadData = async () => {
    try {
      const [storeRes, analyticsRes, subRes, shopifyRes] = await Promise.allSettled([
        axios.get(`/stores/${storeId}`),
        axios.get(`/brand/${storeId}/analytics?days=30`),
        axios.get(`/brand/${storeId}/subscription`),
        axios.get(`/shopify/stores/${storeId}/status`),
      ]);

      if (storeRes.status === 'fulfilled') {
        setStore(storeRes.value.data.data);
      }

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data.data);
      }

      if (subRes.status === 'fulfilled') {
        setSubscription(subRes.value.data.data);
      }

      if (shopifyRes.status === 'fulfilled') {
        setShopifyStatus(shopifyRes.value.data.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmbedCode = async () => {
    try {
      const response = await axios.get(`/brand/${storeId}/embed-code`);
      setEmbedCode(response.data.data.embedCode);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Failed to get embed code';
      console.error('Embed code error:', error.response?.data);

      // Fallback: Generate embed code client-side
      const fallbackCode = `<!-- Flash AI Chat Widget -->
<script>
  (function() {
    window.flashAIConfig = {
      storeId: '${storeId}'
    };
    var script = document.createElement('script');
    script.src = 'https://flash-ai-backend-rld7.onrender.com/widget/${storeId}.js';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>
<!-- End Flash AI Chat Widget -->`;

      setEmbedCode(fallbackCode);
      console.log('Using fallback embed code');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Store not found</h2>
          <Link to="/stores" className="text-primary-600 hover:text-primary-700">
            ← Back to stores
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link to="/stores" className="text-sm text-gray-600 hover:text-gray-900 mb-1 block">
                ← Back to Stores
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{store.store_name || store.domain}</h1>
              <p className="text-sm text-gray-600">Brand Console</p>
            </div>
            <div className="flex gap-2">
              {subscription && (
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 capitalize">
                  {subscription.plan_name} Plan
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('widget')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'widget'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Widget Setup
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'analytics'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('conversations')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'conversations'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Conversations
            </button>
            <button
              onClick={() => setActiveTab('query-analytics')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'query-analytics'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Query Analytics
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'billing'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Billing
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card">
                <div className="text-sm text-gray-600 mb-1">Unique Visitors (30 days)</div>
                <div className="text-3xl font-bold text-gray-900">
                  {analytics?.uniqueVisitors || 0}
                </div>
              </div>
              <div className="card">
                <div className="text-sm text-gray-600 mb-1">Total Conversations</div>
                <div className="text-3xl font-bold text-gray-900">
                  {analytics?.conversationStats?.total_conversations || 0}
                </div>
              </div>
              <div className="card">
                <div className="text-sm text-gray-600 mb-1">Messages Used</div>
                <div className="text-3xl font-bold text-gray-900">
                  {subscription ? `${subscription.messages_used} / ${subscription.message_limit}` : '0'}
                </div>
                {subscription && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{ width: `${(subscription.messages_used / subscription.message_limit) * 100}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate(`/brand/${storeId}/widget`)}
                  className="btn btn-secondary text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Customize Widget</div>
                      <div className="text-sm text-gray-600">Colors, language, personality</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('widget')}
                  className="btn btn-secondary text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">Install Widget</div>
                      <div className="text-sm text-gray-600">Get embed code</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className="btn btn-secondary text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">View Analytics</div>
                      <div className="text-sm text-gray-600">Performance metrics</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Shopify Integration */}
            <div className="card border-2 border-emerald-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Shopify Integration</h3>
                    <p className="text-sm text-gray-600">
                      {shopifyStatus?.connected
                        ? 'Your store is connected to Shopify'
                        : 'Connect your Shopify store for automatic data sync'}
                    </p>
                  </div>
                </div>
                {shopifyStatus?.connected && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                    CONNECTED
                  </span>
                )}
              </div>

              {shopifyStatus?.connected ? (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 mb-1">Shop Domain</p>
                        <p className="font-medium text-gray-900">{shopifyStatus.shopDomain}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-1">Sync Status</p>
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded capitalize ${
                          shopifyStatus.syncStatus === 'completed' ? 'bg-green-100 text-green-800' :
                          shopifyStatus.syncStatus === 'processing' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {shopifyStatus.syncStatus || 'Unknown'}
                        </span>
                      </div>
                      {shopifyStatus.lastSync && (
                        <div className="col-span-2">
                          <p className="text-gray-600 mb-1">Last Synced</p>
                          <p className="font-medium text-gray-900">
                            {new Date(shopifyStatus.lastSync).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/brand/${storeId}/shopify`)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Manage Shopify Integration
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/brand/connect-store')}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-lg text-white font-semibold py-3 px-4 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Connect Shopify Store
                </button>
              )}
            </div>
          </div>
        )}

        {/* Widget Setup Tab */}
        {activeTab === 'widget' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Install Widget on Your Store</h3>
              <p className="text-gray-600 mb-4">
                Add the following code snippet to your store's HTML, just before the closing <code className="bg-gray-100 px-2 py-1 rounded">&lt;/body&gt;</code> tag.
              </p>
              <button
                onClick={loadEmbedCode}
                className="btn btn-primary mb-4"
                disabled={!!embedCode}
              >
                {embedCode ? 'Code Generated' : 'Generate Embed Code'}
              </button>
              {embedCode && (
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm">{embedCode}</pre>
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Widget Preview</h3>
              <p className="text-gray-600 mb-4">
                Coming soon: Live widget preview with customization options
              </p>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Summary (Last 30 Days)</h3>
              {analytics && analytics.eventCounts.length > 0 ? (
                <div className="space-y-2">
                  {analytics.eventCounts.map((event) => (
                    <div key={event.event_type} className="flex justify-between items-center py-2 border-b">
                      <span className="text-gray-700 capitalize">{event.event_type.replace(/_/g, ' ')}</span>
                      <span className="font-semibold text-gray-900">{event.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No analytics data available yet. Install the widget to start tracking.</p>
              )}
            </div>
          </div>
        )}

        {/* Query Analytics Tab */}
        {activeTab === 'query-analytics' && storeId && (
          <AdminAnalytics storeId={storeId} />
        )}

        {/* Conversations Tab */}
        {activeTab === 'conversations' && storeId && (
          <Conversations storeId={storeId} />
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h3>
              {subscription ? (
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 capitalize">{subscription.plan_name}</p>
                      <p className="text-gray-600">${subscription.amount.toFixed(2)} / {subscription.plan_interval}</p>
                    </div>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {subscription.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <p className="text-gray-600">Loading subscription...</p>
              )}
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upgrade Options</h3>
              <p className="text-gray-600">
                Coming soon: Upgrade or change your plan
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
