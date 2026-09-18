/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LayoutBase } from './components/LayoutBase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';

// Páginas carregadas sob demanda: cada uma vira um chunk próprio, baixado só quando
// a rota é visitada. Antes, um paciente que abria só o próprio painel baixava
// também o dashboard administrativo (766 linhas) e o Recharts inteiro, tudo dentro
// de um único bundle de 862 KB. Os guards de rota abaixo continuam import estático
// — são pequenos e vivem neste mesmo arquivo, não geram chunk separado de qualquer forma.
const Login = lazy(() => import('./pages/Login'));
const Cadastro = lazy(() => import('./pages/Cadastro'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const OnboardingInvite = lazy(() => import('./pages/OnboardingInvite'));
const Perfil = lazy(() => import('./pages/Perfil'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));

// Pro Pages
const DashboardPro = lazy(() => import('./pages/pro/Dashboard'));
const PacienteDetail = lazy(() => import('./pages/pro/PacienteDetail'));
const FinanceiroPro = lazy(() => import('./pages/pro/Financeiro'));
const AgendaPro = lazy(() => import('./pages/pro/Agenda'));

// Patient Pages
const DashboardPaciente = lazy(() => import('./pages/paciente/Dashboard'));
const ProgressoPaciente = lazy(() => import('./pages/paciente/Progresso'));
const Chat = lazy(() => import('./pages/paciente/Chat'));
const FinanceiroPaciente = lazy(() => import('./pages/paciente/Financeiro'));
const AgendaPaciente = lazy(() => import('./pages/paciente/Agenda'));

// Mesmo spinner já usado pelos guards abaixo enquanto o chunk da rota carrega.
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
    return isProfessional ? <Navigate to="/pro/dashboard" replace /> : <Navigate to="/paciente/dashboard" replace />;
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
  return isProfessional ? <Navigate to="/pro/dashboard" replace /> : <Navigate to="/paciente/dashboard" replace />;
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
            <Route path="/cadastro" element={<PublicRoute><Cadastro /></PublicRoute>} />
            <Route path="/esqueci-minha-senha" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/convite/:token" element={<PublicRoute><OnboardingInvite /></PublicRoute>} />

            {/* PRIVATE / COMMON ROUTES */}
            <Route path="/perfil" element={<PrivateRoute><Perfil /></PrivateRoute>} />
            <Route path="/paciente/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />

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
                    <DashboardPro />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/pro/paciente/:id"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PROFESSIONAL">
                    <PacienteDetail />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/pro/financeiro"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PROFESSIONAL">
                    <FinanceiroPro />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/pro/agenda"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PROFESSIONAL">
                    <AgendaPro />
                  </RoleGuard>
                </PrivateRoute>
              }
            />

            {/* PATIENT SECURED ROUTES */}
            <Route
              path="/paciente/dashboard"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PATIENT">
                    <DashboardPaciente />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/paciente/agenda"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PATIENT">
                    <AgendaPaciente />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/paciente/progresso"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PATIENT">
                    <ProgressoPaciente />
                  </RoleGuard>
                </PrivateRoute>
              }
            />
            <Route
              path="/paciente/financeiro"
              element={
                <PrivateRoute>
                  <RoleGuard allowedRole="PATIENT">
                    <FinanceiroPaciente />
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

