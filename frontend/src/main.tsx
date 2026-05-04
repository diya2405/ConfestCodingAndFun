// frontend/src/main.tsx
// FIX: /dashboard/:contestId conflicted with /dashboard — changed to /contest-dashboard/:id
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login            from './pages/Login';
import Register         from './pages/Register';
import Dashboard        from './pages/Dashboard';
import Profile          from './pages/Profile';
import Contests         from './pages/Contests';
import CodingArena      from './pages/CodingArena';
import ContestDashboard from './pages/ContestDashboard';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"                        element={<Navigate to="/dashboard" replace />} />
      <Route path="/login"                   element={<Login />} />
      <Route path="/register"                element={<Register />} />
      <Route path="/dashboard"               element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      {/* FIX: was /dashboard/:contestId — conflicted with /dashboard */}
      <Route path="/contest-dashboard/:contestId" element={<ProtectedRoute><ContestDashboard /></ProtectedRoute>} />
      <Route path="/profile"                 element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/contests"                element={<ProtectedRoute><Contests /></ProtectedRoute>} />
      <Route path="/arena/:contestId"        element={<ProtectedRoute><CodingArena /></ProtectedRoute>} />
      <Route path="*"                        element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);