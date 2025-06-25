import React from 'react';
import '../styles/Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p>© {new Date().getFullYear()} 十三水游戏</p>
        <div className="footer-links">
          <a href="#">关于我们</a>
          <a href="#">游戏规则</a>
          <a href="#">联系客服</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
