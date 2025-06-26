// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby.jsx';         // <--- 修改导入后缀
import GameTable from './components/GameTable.jsx'; // <--- 修改导入后缀
// App.css is imported in main.jsx

function App() {
  const [currentPage, setCurrentPage] = useState('lobby');
  const [gameId, setGameId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [initialGameState, setInitialGameState] = useState(null);

  useEffect(() => {
    const savedGameId = localStorage.getItem('十三水_gameId');
    const savedPlayerId = localStorage.getItem('十三水_playerId');
    // Basic re-join attempt logic could be added here later if desired
    // For now, it just pre-fills IDs if user refreshes while in a game,
    // but they'd still effectively rejoin via Lobby unless we add more complex state recovery.
  }, []);

  const handleGameJoinedOrCreated = (newGameId, newPlayerId, gameState) => {
    setGameId(newGameId);
    setPlayerId(newPlayerId);
    setInitialGameState(gameState);
    localStorage.setItem('十三水_gameId', newGameId);
    localStorage.setItem('十三水_playerId', newPlayerId);
    setCurrentPage('game');
  };

  const handleLeaveGame = () => {
    localStorage.removeItem('十三水_gameId');
    setGameId(null);
    setInitialGameState(null);
    setCurrentPage('lobby');
  };

  return (
    <div className="app-container">
      {currentPage === 'lobby' && (
        <Lobby onGameJoinedOrCreated={handleGameJoinedOrCreated} />
      )}
      {currentPage === 'game' && gameId && playerId && (
        <GameTable
          initialGameId={gameId}
          initialPlayerId={playerId}
          initialGameState={initialGameState}
          onLeaveGame={handleLeaveGame}
        />
      )}
    </div>
  );
}

export default App;
