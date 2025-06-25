import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/AuthPage.css';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [mobile, setMobile] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      // 登录
      const success = await login(mobile, password);
      if (success) {
        navigate('/');
      } else {
        setError('手机号或密码错误');
      }
    } else {
      // 注册
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
      
      const success = await register(mobile, nickname, password);
      if (success) {
        navigate('/');
      } else {
        setError('注册失败，手机号可能已被使用');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isLogin ? '登录' : '注册'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>手机号</label>
            <input
              type="tel"
              className="form-control"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="请输入手机号"
              required
            />
          </div>
          
          {!isLogin && (
            <div className="form-group">
              <label>昵称</label>
              <input
                type="text"
                className="form-control"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="请输入昵称"
                required
              />
            </div>
          )}
          
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          
          {!isLogin && (
            <div className="form-group">
              <label>确认密码</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                required
              />
            </div>
          )}
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="btn primary auth-btn">
            {isLogin ? '登录' : '注册'}
          </button>
        </form>
        
        <div className="auth-switch">
          {isLogin ? '没有账号？' : '已有账号？'}
          <button 
            className="switch-btn" 
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? '立即注册' : '立即登录'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
