import { useAuthStore } from '../store/authStore';
import AdminDashboard from './AdminDashboard';
import BrandOwnerDashboard from './BrandOwnerDashboard';

export default function Dashboard() {
  const { user } = useAuthStore();

  // Route based on user role
  if (!user) {
    return null; // Will be redirected by ProtectedRoute
  }

  if (user.role === 'admin') {
    return <AdminDashboard />;
  }

  if (user.role === 'owner' || user.role === 'brand_owner') {
    return <BrandOwnerDashboard />;
  }

  // Default to admin dashboard for 'user' role (backwards compatibility)
  return <AdminDashboard />;
}
