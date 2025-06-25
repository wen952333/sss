import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { searchUserByMobile, transferPoints } from '../services/pointsService';
import '../styles/TransferPoints.css';

const TransferPoints = () => {
  const [mobile, setMobile] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!mobile) {
      setMessage('请输入手机号');
      return;
    }
    
    try {
      setLoading(true);
      const userData = await searchUserByMobile(mobile);
      if (userData) {
        setFoundUser(userData);
        setMessage('');
      } else {
        setFoundUser(null);
        setMessage('未找到该用户');
      }
    } catch (error) {
      setFoundUser(null);
      setMessage('搜索用户失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!foundUser || !amount || isNaN(amount) || parseInt(amount) <= 0) {
      setMessage('请输入有效的转账金额');
      return;
    }
    
    const transferAmount = parseInt(amount);
    
    if (transferAmount > user.points) {
      setMessage('您的积分不足');
      return;
    }
    
    try {
      setLoading(true);
      const result = await transferPoints(foundUser.id, transferAmount);
      if (result.success) {
        setMessage(`成功向 ${foundUser.nickname} 转账 ${amount} 积分`);
        // 更新本地用户积分
        const updatedUser = {
          ...user,
          points: user.points - transferAmount
        };
        localStorage.setItem('thirteenWaterUser', JSON.stringify(updatedUser));
        setFoundUser(null);
        setMobile('');
        setAmount('');
      } else {
        setMessage(result.message || '转账失败');
      }
    } catch (error) {
      setMessage('转账失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="transfer-container">
      <div className="transfer-card">
        <h2>积分转账</h2>
        <p className="current-points">您的积分: {user?.points}</p>
        
        <div className="form-group">
          <label>对方手机号</label>
          <div className="search-container">
            <input
              type="tel"
              className="form-control"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="请输入对方手机号"
              disabled={loading}
            />
            <button 
              className="btn search-btn"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
        </div>
        
        {foundUser && (
          <div className="user-found">
            <p>用户昵称: {foundUser.nickname}</p>
            <p>手机号: {foundUser.mobile}</p>
          </div>
        )}
        
        {foundUser && (
          <div className="form-group">
            <label>转账金额</label>
            <input
              type="number"
              className="form-control"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="请输入转账积分"
              min="1"
              max={user?.points}
              disabled={loading}
            />
          </div>
        )}
        
        {message && <div className={`message ${message.includes('成功') ? 'success' : 'error'}`}>{message}</div>}
        
        {foundUser && (
          <button 
            className="btn transfer-btn"
            onClick={handleTransfer}
            disabled={loading}
          >
            {loading ? '处理中...' : '确认转账'}
          </button>
        )}
        
        <button 
          className="btn back-btn"
          onClick={() => navigate('/')}
          disabled={loading}
        >
          返回首页
        </button>
      </div>
    </div>
  );
};

export default TransferPoints;
