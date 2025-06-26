// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby'; // 确保 Lobby.js 在 frontend/src/components/ 目录下
import GameTable from './components/GameTable'; // 确保 GameTable.js 在 frontend/src/components/ 目录下
// import './App.css'; // App.css 将由 main.jsx 导入，或者你也可以在这里导入，但不要重复

function App() {
  const [currentPage, setCurrentPage] = useState('lobby'); // 'lobby', 'game'
  const [gameId, setGameId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [initialGameState, setInitialGameState] = useState(null);

  useEffect(() => {
    // Attempt to retrieve game session from localStorage on load
    const savedGameId = localStorage.getItem('十三水_gameId');
    const savedPlayerId = localStorage.getItem('十三水_playerId');
    if (savedGameId && savedPlayerId) {
      // Potentially try to rejoin or fetch game state here to resume
      // For simplicity, we'll just pre-fill and let user click join/create
      // Or directly navigate if we're sure session is valid
      // For now, this is just to show we can save/load these IDs
    }
  }, []);

  const handleGameJoinedOrCreated = (newGameId, newPlayerId, gameState) => {
    setGameId(newGameId);
    setPlayerId(newPlayerId);
    setInitialGameState(gameState);
    localStorage.setItem('十三水_gameId', newGameId);
    localStorage.setItem('十三水_playerId', newPlayerId); // PlayerID is set in api.js
    setCurrentPage('game');
  };

  const handleLeaveGame = () => {
    localStorage.removeItem('十三水_gameId');
    // We keep playerId as it's user-specific, not game-specific
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
