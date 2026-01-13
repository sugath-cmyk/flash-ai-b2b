import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Stores from './pages/Stores';
import StoreDetails from './pages/StoreDetails';
import BrandDashboard from './pages/BrandDashboard';
import BrandOnboarding from './pages/BrandOnboarding';
import OnboardingRequests from './pages/OnboardingRequests';
import AdminDashboard from './pages/AdminDashboard';
import BrandOwnerDashboard from './pages/BrandOwnerDashboard';
import Storefront from './pages/Storefront';
import EnhancedProductPage from './pages/EnhancedProductPage';
import ConnectStore from './pages/ConnectStore';
import StoreManagement from './pages/StoreManagement';
import WidgetCustomization from './pages/WidgetCustomization';
import WidgetManagement from './pages/WidgetManagement';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboard" element={<BrandOnboarding />} />
        <Route path="/store" element={<Storefront />} />
        <Route path="/shop" element={<Storefront />} />
        <Route path="/product/:productId" element={<EnhancedProductPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores"
          element={
            <ProtectedRoute>
              <Stores />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores/:storeId"
          element={
            <ProtectedRoute>
              <StoreDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding-requests"
          element={
            <ProtectedRoute>
              <OnboardingRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brand/:storeId"
          element={
            <ProtectedRoute>
              <BrandDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brand-console"
          element={
            <ProtectedRoute>
              <BrandOwnerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brand/connect-store"
          element={
            <ProtectedRoute>
              <ConnectStore />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brand/:storeId/shopify"
          element={
            <ProtectedRoute>
              <StoreManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brand/:storeId/widgets"
          element={
            <ProtectedRoute>
              <WidgetManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brand/:storeId/widget-customization"
          element={
            <ProtectedRoute>
              <WidgetCustomization />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brand/:storeId/widget"
          element={
            <ProtectedRoute>
              <WidgetManagement />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
