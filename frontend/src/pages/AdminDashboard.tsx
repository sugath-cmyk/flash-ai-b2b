import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from '../lib/axios';

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    stores: 0,
    totalProducts: 0,
    totalCollections: 0,
    pendingRequests: 0,
  });
  const [stores, setStores] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [storesRes, requestsRes] = await Promise.all([
        axios.get('/stores'),
        axios.get('/onboarding/requests?status=pending')
      ]);

      if (storesRes.data.success) {
        const storesData = storesRes.data.data;
        setStores(storesData);

        const pendingRequestsData = requestsRes.data.data || [];
        setPendingRequests(pendingRequestsData);

        setStats({
          stores: storesData.length,
          totalProducts: storesData.reduce((sum: number, store: any) => sum + parseInt(store.product_count || 0), 0),
          totalCollections: storesData.reduce((sum: number, store: any) => sum + parseInt(store.collection_count || 0), 0),
          pendingRequests: pendingRequestsData.length,
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Flash AI Platform Admin</h1>
            <div className="flex items-center gap-4">
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">
                Admin
              </span>
              <Link
                to="/profile"
                className="text-sm text-gray-700 hover:text-gray-900 font-medium"
              >
                {user?.firstName} {user?.lastName}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Platform Overview
          </h2>
          <p className="text-gray-600">
            Manage all brand stores and their AI-powered chat widgets.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Total Brands</div>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.stores}
            </div>
            <div className="text-xs text-gray-500 mt-1">Active stores</div>
          </div>

          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Pending Approvals</div>
            <div className="text-3xl font-bold text-orange-600">
              {loading ? '...' : stats.pendingRequests}
            </div>
            <div className="text-xs text-gray-500 mt-1">Awaiting review</div>
          </div>

          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Total Products</div>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.totalProducts}
            </div>
            <div className="text-xs text-gray-500 mt-1">Across all stores</div>
          </div>

          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Total Collections</div>
            <div className="text-3xl font-bold text-gray-900">
              {loading ? '...' : stats.totalCollections}
            </div>
            <div className="text-xs text-gray-500 mt-1">Across all stores</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/onboarding-requests"
              className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Onboarding Requests</h4>
                  <p className="text-sm text-gray-600">Review & approve brand applications</p>
                </div>
              </div>
            </Link>

            <Link
              to="/stores"
              className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Import New Store</h4>
                  <p className="text-sm text-gray-600">Add a new brand to the platform</p>
                </div>
              </div>
            </Link>

            <Link
              to="/stores"
              className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">View All Stores</h4>
                  <p className="text-sm text-gray-600">Manage existing brand stores</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Pending Brand Registrations */}
        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Pending Brand Registrations
                <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                  {pendingRequests.length} New
                </span>
              </h3>
              <Link to="/onboarding-requests" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                View all →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingRequests.slice(0, 4).map((request) => (
                <div key={request.id} className="card border-l-4 border-orange-400">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {request.brand_name}
                      </h4>
                      <p className="text-sm text-gray-600">{request.email}</p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                      Pending
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Store:</span> {request.store_url}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Platform:</span> {request.store_platform}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Contact:</span> {request.contact_name}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      to={`/onboarding-requests/${request.id}`}
                      className="flex-1 text-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
                    >
                      Review & Approve
                    </Link>
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Stores */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Stores</h3>
            <Link to="/stores" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading stores...</div>
          ) : stores.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-600 mb-4">No stores imported yet</p>
              <Link to="/stores" className="btn btn-primary inline-block">
                Import Your First Store
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.slice(0, 6).map((store) => (
                <div key={store.id} className="card">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900">
                      {store.store_name || store.domain}
                    </h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      store.sync_status === 'completed' || store.sync_status === 'active' ? 'bg-green-100 text-green-800' :
                      store.sync_status === 'failed' ? 'bg-red-100 text-red-800' :
                      store.sync_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {store.sync_status === 'active' ? 'Active' : store.sync_status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{store.platform}</p>
                  <Link
                    to={`/brand/${store.id}`}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Manage Brand Console →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
