import React, { useState, useEffect } from 'react';
import GameLobby from './components/GameLobby';
import GameTable from './components/GameTable';
import './App.css';

function App() {
  const [gameState, setGameState] = useState('lobby'); // lobby, playing, finished
  const [user, setUser] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [players, setPlayers] = useState([]);
  
  // 创建新游戏
  const createGame = async () => {
    try {
      const response = await fetch('https://9526.ip-ddns.com/api/game.php?action=create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (data.success) {
        setGameData(data.game);
        setGameState('playing');
      }
    } catch (error) {
      console.error('创建游戏失败:', error);
    }
  };
  
  // 加入游戏
  const joinGame = async (gameId) => {
    try {
      const response = await fetch(`https://9526.ip-ddns.com/api/game.php?action=join&gameId=${gameId}&userId=${user.id}`);
      const data = await response.json();
      if (data.success) {
        setGameData(data.game);
        setPlayers(data.players);
        setGameState('playing');
      }
    } catch (error) {
      console.error('加入游戏失败:', error);
    }
  };
  
  // 轮询游戏状态
  useEffect(() => {
    if (gameState === 'playing' && gameData) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`https://9526.ip-ddns.com/api/game.php?action=status&gameId=${gameData.id}`);
          const data = await response.json();
          if (data.success) {
            setGameData(data.game);
            setPlayers(data.players);
            if (data.game.status === 'finished') {
              setGameState('finished');
            }
          }
        } catch (error) {
          console.error('获取游戏状态失败:', error);
        }
      }, 3000); // 每3秒轮询一次
      
      return () => clearInterval(interval);
    }
  }, [gameState, gameData]);
  
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>十三水多人游戏</h1>
        {user && <div className="user-info">玩家: {user.name}</div>}
      </header>
      
      <main className="game-container">
        {gameState === 'lobby' && (
          <GameLobby 
            user={user} 
            setUser={setUser} 
            createGame={createGame} 
            joinGame={joinGame} 
          />
        )}
        
        {gameState === 'playing' && gameData && (
          <GameTable 
            gameData={gameData} 
            players={players} 
            userId={user.id} 
          />
        )}
        
        {gameState === 'finished' && gameData && (
          <div className="game-finished">
            <h2>游戏结束!</h2>
            <div className="winners">
              {gameData.winners.map(winner => (
                <div key={winner.id} className="winner">
                  <div>{winner.name}</div>
                  <div>得分: {winner.score}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setGameState('lobby')}>返回大厅</button>
          </div>
        )}
      </main>
      
      <footer className="app-footer">
        <p>© 2023 十三水游戏 | 前端: https://ss.wenge.ip-ddns.com | 后端: https://9526.ip-ddns.com</p>
      </footer>
    </div>
  );
}

export default App;
