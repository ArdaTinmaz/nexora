import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import WelcomePage from './pages/WelcomePage/WelcomePage';
import AuthPage from './pages/AuthPage/AuthPage';
import HomePage from './pages/HomePage/HomePage';
import ResetPasswordPage from './pages/ResetPasswordPage/ResetPasswordPage';
import AdminConsole from './pages/AdminConsole/AdminConsole';
import AdminLogin from './pages/AdminLogin/AdminLogin';
import DesktopRouteHandler from './components/DesktopRouteHandler/DesktopRouteHandler';

function App() {
  return (
    <>
      <DesktopRouteHandler />
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/auth/:id" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminConsole />} />
        <Route path="/home/*" element={<HomePage />} />
        <Route path="/" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </>
  );
}

export default App;
