import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Header.css';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <Link to="/" className="logo">
          <h1>十三水</h1>
        </Link>
        
        <div className="header-right">
          {user ? (
            <>
              <span className="user-info">
                <span className="nickname">{user.nickname}</span>
                <span className="points">积分: {user.points}</span>
              </span>
              <button className="btn logout-btn" onClick={handleLogout}>
                退出
              </button>
            </>
          ) : (
            <Link to="/auth" className="btn login-btn">
              登录/注册
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
