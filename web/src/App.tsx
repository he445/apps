import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LayoutBase } from './components/LayoutBase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';

// Pages are loaded on demand: each becomes its own chunk, downloaded only when the
// route is visited. A patient opening just their own panel used to also download the
// admin dashboard and the whole of Recharts, inside a single 862 KB bundle. The route
// guards below stay static imports — they are small and live in this same file, so
// they would not get a separate chunk anyway.
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const OnboardingInvite = lazy(() => import('./pages/OnboardingInvite'));
const Profile = lazy(() => import('./pages/Profile'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));

// Pro Pages
const ProfessionalDashboard = lazy(() => import('./pages/pro/Dashboard'));
const PatientDetail = lazy(() => import('./pages/pro/PatientDetail'));
const ProfessionalFinance = lazy(() => import('./pages/pro/Finance'));
const ProfessionalSchedule = lazy(() => import('./pages/pro/Schedule'));

// Patient Pages
const PatientDashboard = lazy(() => import('./pages/patient/Dashboard'));
const PatientProgress = lazy(() => import('./pages/patient/Progress'));
const Chat = lazy(() => import('./pages/patient/Chat'));
const PatientFinance = lazy(() => import('./pages/patient/Finance'));
const PatientSchedule = lazy(() => import('./pages/patient/Schedule'));

// The same spinner the guards below use, shown while the route chunk loads.
const RouteFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A8B76]" />
  </div>
);

// --- ROUTE GUARDS ---

// Authenticated Routes Guard
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A8B76]" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Unauthenticated (Public) Routes Guard
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isProfessional, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A8B76]" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    return isProfessional ? <Navigate to="/pro/dashboard" replace /> : <Navigate to="/patient/dashboard" replace />;
  }

  return <>{children}</>;
};

// Role Authorization Guard
const RoleGuard: React.FC<{
  children: React.ReactNode;
  allowedRole: 'PROFESSIONAL' | 'PATIENT' | 'ADMIN' | ('PROFESSIONAL' | 'PATIENT' | 'ADMIN')[];
}> = ({ children, allowedRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A8B76]" />
      </div>
    );
  }

  const allowedRoles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
  if (!user || !allowedRoles.includes(user.role as any)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Redirect root to correct dashboard or login
const RootRedirect: React.FC = () => {
  const { isAuthenticated, isProfessional, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A8B76]" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
  return isProfessional ? <Navigate to="/pro/dashboard" replace /> : <Navigate to="/patient/dashboard" replace />;
};

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <LayoutBase>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* PUBLIC ROUTES */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/invite/:token" element={<PublicRoute><OnboardingInvite /></PublicRoute>} />
            {/* Outside PublicRoute on purpose: that guard bounces an authenticated
                visitor to their dashboard, and someone already using the app has to be
                able to read what they agreed to. */}
            <Route path="/privacidade" element={<PrivacyPolicy />} />

            {/* PRIVATE / COMMON ROUTES */}
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/patient/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />

            {/* ADMIN SECURED ROUTES */}
            <Route
              path="/admin/dashboard"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="ADMIN">
                    <AdminDashboard />
                  </RoleGuard>
                </PrivateRoute>
              }
            />

            {/* PROFESSIONAL SECURED ROUTES */}
            <Route
              path="/pro/dashboard"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PROFESSIONAL">
                    <ProfessionalDashboard />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/pro/patient/:id"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PROFESSIONAL">
                    <PatientDetail />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/pro/finance"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PROFESSIONAL">
                    <ProfessionalFinance />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/pro/schedule"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PROFESSIONAL">
                    <ProfessionalSchedule />
                  </RoleGuard>
                </PrivateRoute>
              }
            />

            {/* PATIENT SECURED ROUTES */}
            <Route
              path="/patient/dashboard"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PATIENT">
                    <PatientDashboard />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/patient/schedule"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PATIENT">
                    <PatientSchedule />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/patient/progress"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PATIENT">
                    <PatientProgress />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/patient/finance"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PATIENT">
                    <PatientFinance />
                  </RoleGuard>
                </PrivateRoute>
              }
            />

            {/* ROOT FALLBACK */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </LayoutBase>
      </BrowserRouter>
      
      {/* Toast notifications handler */}
      <Toaster position="top-right" richColors />
    </AuthProvider>
    </ErrorBoundary>
  );
}

