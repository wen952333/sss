import React from 'react';
import '../styles/Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p>© {new Date().getFullYear()} 十三水游戏</p>
        <div className="footer-links">
          <span>关于我们</span>
          <span>游戏规则</span>
          <span>联系客服</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
