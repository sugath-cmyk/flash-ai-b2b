import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from '../lib/axios';

interface OnboardingRequest {
  id: string;
  brand_name: string;
  contact_name: string;
  email: string;
  phone: string;
  store_url: string;
  store_platform: string;
  business_address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  gst_number: string;
  monthly_traffic: string;
  current_support: string;
  hear_about_us: string;
  additional_info: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string;
  created_at: string;
}

export default function OnboardingRequests() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<OnboardingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredRequests(requests);
    } else {
      setFilteredRequests(requests.filter(r => r.status === statusFilter));
    }
  }, [statusFilter, requests]);

  const loadRequests = async () => {
    try {
      const response = await axios.get('/onboarding/requests');
      setRequests(response.data.data);
      setFilteredRequests(response.data.data);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this brand onboarding? This will create a brand account and send login credentials.')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await axios.post(`/onboarding/requests/${id}/approve`);
      const { email, tempPassword } = response.data.data;

      alert(`✅ Brand approved!\n\nLogin credentials:\nEmail: ${email}\nPassword: ${tempPassword}\n\nPlease share these credentials with the brand owner securely.`);

      loadRequests();
      setShowModal(false);
    } catch (error: any) {
      alert('Failed to approve: ' + (error.response?.data?.error?.message || error.response?.data?.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(true);
    try {
      await axios.post(`/onboarding/requests/${id}/reject`, {
        reason: rejectReason,
      });

      alert('Onboarding request rejected');
      loadRequests();
      setShowModal(false);
      setRejectReason('');
    } catch (error: any) {
      alert('Failed to reject: ' + (error.response?.data?.error?.message || error.response?.data?.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this onboarding request? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`/onboarding/requests/${id}`);
      alert('Request deleted');
      loadRequests();
      setShowModal(false);
    } catch (error: any) {
      alert('Failed to delete: ' + (error.response?.data?.error?.message || error.response?.data?.message || 'Unknown error'));
    }
  };

  const openModal = (request: OnboardingRequest) => {
    setSelectedRequest(request);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedRequest(null);
    setRejectReason('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
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
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Onboarding Requests</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/profile" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
                {user?.firstName} {user?.lastName}
              </Link>
              <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                statusFilter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({requests.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                statusFilter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({requests.filter(r => r.status === 'pending').length})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                statusFilter === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Approved ({requests.filter(r => r.status === 'approved').length})
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                statusFilter === 'rejected'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rejected ({requests.filter(r => r.status === 'rejected').length})
            </button>
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">No {statusFilter !== 'all' ? statusFilter : ''} onboarding requests found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredRequests.map((request) => (
              <div key={request.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{request.brand_name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Contact:</span>
                        <p className="font-medium text-gray-900">{request.contact_name}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Email:</span>
                        <p className="font-medium text-gray-900">{request.email}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Platform:</span>
                        <p className="font-medium text-gray-900">{request.store_platform}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Submitted:</span>
                        <p className="font-medium text-gray-900">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <a
                        href={request.store_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        {request.store_url} →
                      </a>
                    </div>
                  </div>

                  <button
                    onClick={() => openModal(request)}
                    className="btn btn-secondary ml-4"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedRequest.brand_name}</h2>
                  <span className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedRequest.status)}`}>
                    {selectedRequest.status}
                  </span>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Brand Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Brand Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Contact Person:</span>
                    <p className="font-medium text-gray-900">{selectedRequest.contact_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <p className="font-medium text-gray-900">{selectedRequest.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <p className="font-medium text-gray-900">{selectedRequest.phone}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">GST Number:</span>
                    <p className="font-medium text-gray-900">{selectedRequest.gst_number || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Store Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Store Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Store URL:</span>
                    <p className="font-medium text-gray-900">
                      <a href={selectedRequest.store_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">
                        {selectedRequest.store_url} →
                      </a>
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Platform:</span>
                    <p className="font-medium text-gray-900">{selectedRequest.store_platform}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Monthly Traffic:</span>
                    <p className="font-medium text-gray-900">{selectedRequest.monthly_traffic || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Support:</span>
                    <p className="font-medium text-gray-900">{selectedRequest.current_support || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Business Address */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Business Address</h3>
                <p className="text-sm text-gray-900">
                  {selectedRequest.business_address}<br />
                  {selectedRequest.city}, {selectedRequest.state} {selectedRequest.zip_code}<br />
                  {selectedRequest.country}
                </p>
              </div>

              {/* Additional Information */}
              {selectedRequest.additional_info && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h3>
                  <p className="text-sm text-gray-700">{selectedRequest.additional_info}</p>
                </div>
              )}

              {selectedRequest.admin_notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Admin Notes</h3>
                  <p className="text-sm text-gray-700">{selectedRequest.admin_notes}</p>
                </div>
              )}

              {/* Actions */}
              {selectedRequest.status === 'pending' && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>

                  <div className="space-y-4">
                    <button
                      onClick={() => handleApprove(selectedRequest.id)}
                      disabled={actionLoading}
                      className="btn btn-primary w-full"
                    >
                      {actionLoading ? 'Processing...' : '✓ Approve & Create Brand Account'}
                    </button>

                    <div>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (optional)"
                        className="input mb-2"
                        rows={3}
                      />
                      <button
                        onClick={() => handleReject(selectedRequest.id)}
                        disabled={actionLoading}
                        className="btn btn-secondary w-full text-red-600 hover:bg-red-50"
                      >
                        {actionLoading ? 'Processing...' : '✗ Reject Request'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {selectedRequest.status !== 'pending' && (
                <div className="border-t pt-6">
                  <button
                    onClick={() => handleDelete(selectedRequest.id)}
                    className="btn btn-secondary w-full text-red-600 hover:bg-red-50"
                  >
                    Delete Request
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
