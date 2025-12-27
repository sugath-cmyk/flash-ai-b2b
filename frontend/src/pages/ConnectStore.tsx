import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosInstance from '../lib/axios';

const ConnectStore: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [shopDomain, setShopDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Check for error from OAuth callback
    const errorMessage = searchParams.get('error');
    if (errorMessage) {
      setError(decodeURIComponent(errorMessage));
    }
  }, [searchParams]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate shop domain
      if (!shopDomain.trim()) {
        setError('Please enter your Shopify store domain');
        setLoading(false);
        return;
      }

      // Normalize domain (remove https://, trailing slashes)
      let normalizedDomain = shopDomain.trim().toLowerCase();
      normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '');
      normalizedDomain = normalizedDomain.replace(/\/$/, '');

      // Make authenticated request to get Shopify OAuth URL
      // The backend will return the authorization URL or redirect us
      const response = await axiosInstance.get(`/shopify/auth?shop=${normalizedDomain}`);

      // If backend returns a redirect URL, use it
      if (response.data.redirectUrl) {
        window.location.href = response.data.redirectUrl;
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.response?.data?.message || 'Failed to connect to Shopify');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <svg
              className="w-16 h-16 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Connect Your Shopify Store
          </h1>
          <p className="text-lg text-gray-600">
            Link your Shopify store to enable AI-powered chat widget
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-emerald-600 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-emerald-800 font-medium">{success}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-red-600 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-red-800 font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Connection Form */}
          <form onSubmit={handleConnect} className="space-y-6">
            <div>
              <label htmlFor="shopDomain" className="block text-sm font-medium text-gray-700 mb-2">
                Shopify Store Domain
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="shopDomain"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="mystore.myshopify.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  disabled={loading}
                />
                {!shopDomain.includes('.myshopify.com') && shopDomain.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    💡 Tip: Enter your full Shopify domain (e.g., mystore.myshopify.com)
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !shopDomain.trim()}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                  Connecting...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Connect Shopify Store
                </div>
              )}
            </button>
          </form>

          {/* Info Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">What happens next?</h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-xs font-bold text-emerald-600">1</span>
                </div>
                <p className="text-sm text-gray-600">
                  You'll be redirected to Shopify to authorize Flash AI
                </p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-xs font-bold text-emerald-600">2</span>
                </div>
                <p className="text-sm text-gray-600">
                  We'll import your products, collections, and store information
                </p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-xs font-bold text-emerald-600">3</span>
                </div>
                <p className="text-sm text-gray-600">
                  Your AI chat widget will be ready to embed on your store
                </p>
              </div>
            </div>
          </div>

          {/* Security Note */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-blue-800">
                <span className="font-semibold">Secure Connection:</span> Flash AI uses Shopify's
                official OAuth for secure authentication. We never store your Shopify password.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/brand-dashboard')}
            className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectStore;
