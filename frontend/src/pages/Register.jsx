import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Register() {
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  async function handleRegister() {
    if (!phone || !nickname || !password) {
      alert('请填写完整信息');
      return;
    }
    const res = await fetch('https://9526.ip-ddns.com/api/register.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, nickname, password }),
    });
    const data = await res.json();
    if (data.success) {
      // 注册成功后自动登录
      const loginRes = await fetch('https://9526.ip-ddns.com/api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const loginData = await loginRes.json();
      if (loginData.success) {
        localStorage.setItem('token', loginData.token);
        localStorage.setItem('nickname', loginData.nickname);
        localStorage.setItem('phone', phone); // 关键：存手机号
        navigate('/');
      } else {
        alert(loginData.message || '自动登录失败，请手动登录');
        navigate('/login');
      }
    } else {
      alert(data.message || '注册失败');
    }
  }

  return (
    <div className="home-container" style={{ background: "#185a30" }}>
      <div className="home-title">用户注册</div>
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
        placeholder="昵称"
        value={nickname}
        onChange={e => setNickname(e.target.value)}
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
        onClick={handleRegister}
      >注册</button>
      <div className="tips">
        已有账号？
        <span style={{color: '#4f8cff', cursor: 'pointer'}} onClick={() => navigate('/login')}>去登录</span>
      </div>
    </div>
  );
}
