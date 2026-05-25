import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Onboarding from './screens/Onboarding/index.jsx';
import Login from './screens/Login/index.jsx';
import Home from './screens/Home/index.jsx';
import Capture from './screens/Capture/index.jsx';
import History from './screens/History/index.jsx';
import Rx from './screens/Rx/index.jsx';
import Profile from './screens/Profile/index.jsx';
import Admin from './screens/Admin/index.jsx';
import BottomNav from './components/BottomNav.jsx';

function ProtectedLayout({ children }) {
  return (
    <div style={{ paddingBottom: '70px' }}>
      {children}
      <BottomNav />
    </div>
  );
}

function RequireAuth({ children }) {
  const token = localStorage.getItem('medrem_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/admin" element={<Admin />} />

        {/* Protected patient screens */}
        <Route path="/" element={<RequireAuth><ProtectedLayout><Home /></ProtectedLayout></RequireAuth>} />
        <Route path="/capture/:doseId" element={<RequireAuth><Capture /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><ProtectedLayout><History /></ProtectedLayout></RequireAuth>} />
        <Route path="/rx" element={<RequireAuth><ProtectedLayout><Rx /></ProtectedLayout></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProtectedLayout><Profile /></ProtectedLayout></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
