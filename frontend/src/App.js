import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import RoomPage from './pages/RoomPage';
import TransferPoints from './pages/TransferPoints';
import Header from './components/Header';
import Footer from './components/Footer';
import { AuthProvider, useAuth } from './context/AuthContext';
import './styles/App.css'; // 更新导入路径

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Header />
          <main className="main-content">
            <AppRoutes />
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/auth" />} />
      <Route path="/auth" element={!isAuthenticated ? <AuthPage /> : <Navigate to="/" />} />
      <Route path="/room/:id" element={isAuthenticated ? <RoomPage /> : <Navigate to="/auth" />} />
      <Route path="/transfer" element={isAuthenticated ? <TransferPoints /> : <Navigate to="/auth" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
