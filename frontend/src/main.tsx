import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login        from './pages/Login';
import Register     from './pages/Register';
import Dashboard    from './pages/Dashboard';
import Profile      from './pages/Profile';
import Contests     from './pages/Contests';
import CodingArena  from './pages/CodingArena';
 
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};
 
function AppRoutes() {
  return (
    <Routes>
      <Route path="/"                 element={<Navigate to="/dashboard" />} />
      <Route path="/login"            element={<Login />} />
      <Route path="/register"         element={<Register />} />
      <Route path="/dashboard"        element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile"          element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/contests"         element={<ProtectedRoute><Contests /></ProtectedRoute>} />
      <Route path="/arena/:contestId" element={<ProtectedRoute><CodingArena /></ProtectedRoute>} />
      <Route path="*"                 element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}
 
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);
 