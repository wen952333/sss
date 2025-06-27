import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  async function handleLogin() {
    if (!phone || !password) {
      alert('请填写手机号和密码');
      return;
    }
    const res = await fetch('https://9526.ip-ddns.com/api/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('nickname', data.nickname);
      localStorage.setItem('phone', phone); // 关键：存手机号
      navigate('/');
    } else {
      alert(data.message || '登录失败');
    }
  }

  return (
    <div className="home-container" style={{ background: "#185a30" }}>
      <div className="home-title">用户登录</div>
      <input
        className="input"
        style={{ width: '100%', marginBottom: 0 }}
        placeholder="手机号"
        value={phone}
        onChange={e => setPhone(e.target.value)}
      />
      <input
        className="input"
        style={{ width: '100%', marginBottom: 0 }}
        placeholder="密码"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button
        className="button"
        style={{ width: '100%', marginTop: 18, marginBottom: 0 }}
        onClick={handleLogin}
      >登录</button>
      <div className="tips">
        没有账号？
        <span style={{color: '#4f8cff', cursor: 'pointer'}} onClick={() => navigate('/register')}>去注册</span>
      </div>
    </div>
  );
}
