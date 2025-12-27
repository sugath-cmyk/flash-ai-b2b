import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from '../lib/axios';

export default function BrandOwnerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Brand owners should be automatically redirected to their brand console
    const redirectToBrandConsole = async () => {
      try {
        // Check if user is admin
        if (user?.role === 'admin') {
          console.log('Admin user detected, redirecting to admin dashboard');
          navigate('/admin-dashboard', { replace: true });
          return;
        }

        // Get the user's store
        const response = await axios.get('/stores');
        const stores = response.data.data;

        if (stores.length > 0) {
          // Redirect to their brand console
          navigate(`/brand/${stores[0].id}`, { replace: true });
        } else {
          // No store found - should not happen for brand owners
          console.error('Brand owner has no associated store');
          setError('No store found for your account. Please contact support.');
        }
      } catch (error: any) {
        console.error('Failed to load brand store:', error);
        setError('Failed to load your store. Please try again.');
      }
    };

    if (user) {
      redirectToBrandConsole();
    }
  }, [navigate, user]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-lg font-semibold">{error}</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your brand console...</p>
          </>
        )}
      </div>
    </div>
  );
}
