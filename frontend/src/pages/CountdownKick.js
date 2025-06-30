import React, { useEffect, useRef, useState } from 'react';

/**
 * 倒计时与超时踢人组件
 * props:
 *   enabled: 是否启用倒计时
 *   remain: 初始剩余秒数
 *   onKick: 超时回调（会被踢出时调用，父组件负责页面跳转等）
 */
export default function CountdownKick({ enabled, remain, onKick }) {
  const [count, setCount] = useState(remain || 45);
  const timerRef = useRef();

  // 外部 remain 变化时重置
  useEffect(() => {
    if (enabled) setCount(remain || 45);
    else setCount(null);
  }, [enabled, remain]);

  // 倒计时逻辑
  useEffect(() => {
    if (!enabled || count == null) {
      clearInterval(timerRef.current);
      return;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          if (onKick) onKick();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [enabled, count, onKick]);

  if (!enabled || count == null || count <= 0) return null;

  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      top: 18,
      transform: 'translateX(-50%)',
      zIndex: 1001,
      background: '#fff',
      color: count <= 10 ? 'red' : '#185a30',
      fontWeight: 900,
      fontSize: 28,
      borderRadius: 10,
      padding: '2px 18px',
      boxShadow: '0 2px 10px #23e67a33',
      minWidth: 50,
      textAlign: 'center'
    }}>
      {count}
    </div>
  );
}
