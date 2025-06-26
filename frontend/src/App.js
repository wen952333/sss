// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import './App.css'; // Global styles

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
  
  // Clean up gameId from localstorage if user navigates away or closes tab without "leaving"
  // This is a bit aggressive, but helps prevent stale game IDs.
  // useEffect(() => {
  //   const handleBeforeUnload = (event) => {
  //     // if (currentPage === 'game') {
  //     //   localStorage.removeItem('十三水_gameId'); // Or call a "leave" API
  //     // }
  //   };
  //   window.addEventListener('beforeunload', handleBeforeUnload);
  //   return () => {
  //     window.removeEventListener('beforeunload', handleBeforeUnload);
  //   };
  // }, [currentPage]);


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
