/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LayoutBase } from './components/LayoutBase';
import { Toaster } from 'sonner';

// Import Pages
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import ForgotPassword from './pages/ForgotPassword';
import OnboardingInvite from './pages/OnboardingInvite';
import Perfil from './pages/Perfil';

// Pro Pages
import DashboardPro from './pages/pro/Dashboard';
import PacienteDetail from './pages/pro/PacienteDetail';
import FinanceiroPro from './pages/pro/Financeiro';
import AgendaPro from './pages/pro/Agenda';

// Patient Pages
import DashboardPaciente from './pages/paciente/Dashboard';
import ProgressoPaciente from './pages/paciente/Progresso';
import Chat from './pages/paciente/Chat';
import FinanceiroPaciente from './pages/paciente/Financeiro';
import AgendaPaciente from './pages/paciente/Agenda';

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
  const { isAuthenticated, isProfessional, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A8B76]" />
      </div>
    );
  }

  if (isAuthenticated) {
    return isProfessional ? <Navigate to="/pro/dashboard" replace /> : <Navigate to="/paciente/dashboard" replace />;
  }

  return <>{children}</>;
};

// Role Authorization Guard
const RoleGuard: React.FC<{ children: React.ReactNode; allowedRole: 'PROFESSIONAL' | 'PATIENT' }> = ({
  children,
  allowedRole,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A8B76]" />
      </div>
    );
  }

  if (!user || user.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Redirect root to correct dashboard or login
const RootRedirect: React.FC = () => {
  const { isAuthenticated, isProfessional, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A8B76]" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return isProfessional ? <Navigate to="/pro/dashboard" replace /> : <Navigate to="/paciente/dashboard" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <LayoutBase>
          <Routes>
            {/* PUBLIC ROUTES */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/cadastro" element={<PublicRoute><Cadastro /></PublicRoute>} />
            <Route path="/esqueci-minha-senha" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/convite/:token" element={<PublicRoute><OnboardingInvite /></PublicRoute>} />

            {/* PRIVATE / COMMON ROUTES */}
            <Route path="/perfil" element={<PrivateRoute><Perfil /></PrivateRoute>} />
            <Route path="/paciente/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />

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
        </LayoutBase>
      </BrowserRouter>
      
      {/* Toast notifications handler */}
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

