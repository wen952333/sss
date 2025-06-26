import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Play.css';

const CARD_PATH = '/cards/';

function cardSvg(name) {
  return `${CARD_PATH}${name}.svg`;
}

export default function Play() {
  const { roomId } = useParams();
  const [myCards, setMyCards] = useState([]);
  const [submit, setSubmit] = useState(false);
  const [result, setResult] = useState(null);
  const [allPlayed, setAllPlayed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMyCards();
  }, []);

  async function fetchMyCards() {
    const token = localStorage.getItem('token');
    const res = await fetch(`https://9526.ip-ddns.com/api/my_cards.php?roomId=${roomId}&token=${token}`);
    const data = await res.json();
    if (data.success) {
      setMyCards(data.cards);
      setSubmit(data.submitted);
      setResult(data.result);
      setAllPlayed(data.allPlayed);
    } else if (data.code === 401) {
      alert('身份验证失败');
      navigate('/');
    }
  }

  async function handleSubmit(cards) {
    const token = localStorage.getItem('token');
    const res = await fetch('https://9526.ip-ddns.com/api/play.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token, cards }),
    });
    const data = await res.json();
    if (data.success) {
      setSubmit(true);
      fetchMyCards();
    } else {
      alert(data.message || '提交失败');
    }
  }

  if (result) {
    return (
      <div className="result-container">
        <h2>结算结果</h2>
        <div>
          {result.map((r, idx) => (
            <div key={idx}>{r.name}: {r.score}分</div>
          ))}
        </div>
        <button className="button" onClick={() => navigate('/')}>返回大厅</button>
      </div>
    );
  }

  return (
    <div className="play-container">
      <h2>十三水配牌</h2>
      <div className="cards-area">
        {myCards.map((card, idx) => (
          <img
            key={idx}
            src={cardSvg(card)}
            alt={card}
            className="card-img"
            draggable={false}
          />
        ))}
      </div>
      {!submit && (
        <button className="button" onClick={() => handleSubmit(myCards)}>
          提交牌型
        </button>
      )}
      {submit && !allPlayed && (
        <div className="tip">等待其他玩家配牌...</div>
      )}
    </div>
  );
}
