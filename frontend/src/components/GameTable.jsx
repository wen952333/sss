// frontend/src/components/GameTable.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PlayerHand from './PlayerHand.jsx';   // <--- 修改导入后缀
import HandDisplay from './HandDisplay.jsx'; // <--- 修改导入后缀
import { getGameState, startGameApi, nextRoundApi, getHandTypeName } from '../utils/api';

const GameTable = ({ initialGameId, initialPlayerId, initialGameState, onLeaveGame }) => {
  const [gameId, setGameId] = useState(initialGameId);
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const [gameState, setGameState] = useState(initialGameState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const currentPlayer = gameState?.players?.find(p => p.id === playerId);
  const otherPlayers = gameState?.players?.filter(p => p.id !== playerId) || [];

  const fetchGameState = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await getGameState(gameId);
      if (data.success) {
        setGameState(data.gameState);
        setError('');
      } else {
        setError(data.message || '获取游戏状态失败');
        if (data.message === 'Game not found.') {
            onLeaveGame();
        }
      }
    } catch (err) {
      setError('获取游戏状态时发生网络错误: ' + err.message);
    }
  }, [gameId, onLeaveGame]);

  useEffect(() => {
    fetchGameState();
    const intervalId = setInterval(fetchGameState, 3000);
    return () => clearInterval(intervalId);
  }, [fetchGameState]);


  const handleStartGame = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await startGameApi(gameId);
      if (data.success) {
        setGameState(data.gameState);
      } else {
        setError(data.message || '开始游戏失败');
      }
    } catch (err) {
      setError('开始游戏时发生网络错误: ' + err.message);
    }
    setIsLoading(false);
  };
  
  const handleNextRound = async () => {
    setIsLoading(true);
    setError('');
    try {
        const data = await nextRoundApi(gameId);
        if (data.success) {
            setGameState(data.gameState);
        } else {
            setError(data.message || '开始下一局失败');
        }
    } catch (err) {
        setError('开始下一局时发生网络错误: ' + err.message);
    }
    setIsLoading(false);
  };

  const handleHandSubmitted = (newGameState) => {
    setGameState(newGameState);
  };

  if (!gameState) {
    return <div className="game-table"><p>加载中或游戏不存在...</p><button onClick={onLeaveGame}>返回大厅</button></div>;
  }
  
  const renderPlayerStatus = () => {
    if (!gameState || !gameState.players) return null;
    return (
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <h4>玩家状态:</h4>
        {gameState.players.map(p => (
          <span key={p.id} style={{
            margin: '0 5px',
            padding: '3px 7px',
            borderRadius: '4px',
            backgroundColor: p.hasSubmitted ? '#2e7d32' : '#757575',
            color: 'white',
            border: p.id === playerId ? '2px solid yellow' : 'none'
          }}>
            {p.name}: {p.hasSubmitted ? "已提交" : "理牌中"} (总分: {p.score})
          </span>
        ))}
      </div>
    );
  };

  const renderResults = () => {
    if (!gameState.roundResults || Object.keys(gameState.roundResults).length === 0 || gameState.status !== 'finished_round') {
        return null;
    }
    const { scores, comparisons, special_bonuses } = gameState.roundResults;
    return (
        <div className="results-display">
            <h3>本局结果</h3>
            <h4>本局得分:</h4>
            <table>
                <thead>
                    <tr><th>玩家</th><th>本局得分</th><th>特殊牌型加分</th><th>总分</th></tr>
                </thead>
                <tbody>
                    {gameState.players.map(p => (
                        <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>{scores?.[p.id] !== undefined ? scores[p.id] - (special_bonuses?.[p.id] || 0) : 'N/A'}</td>
                            <td>{special_bonuses?.[p.id] || 0}</td>
                            <td>{p.score}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
  };

  return (
    <div className="game-table">
      <h2>房间号: {gameId} <button onClick={onLeaveGame} style={{fontSize: '0.7em', padding: '5px'}}>离开房间</button></h2>
      <p className="game-status">状态: {gameState.status}</p>
      {error && <p className="error-message">{error}</p>}
      {renderPlayerStatus()}

      {gameState.status === 'waiting' && (
        <button onClick={handleStartGame} disabled={isLoading || gameState.players.length < 2}>
          {isLoading ? '处理中...' : `开始游戏 (${gameState.players.length}/${gameState.maxPlayers}人)`}
        </button>
      )}

      {currentPlayer && gameState.status === 'arranging' && (
        <PlayerHand
          gameId={gameId}
          player={currentPlayer}
          initialCards={currentPlayer.hand}
          onHandSubmitted={handleHandSubmitted}
          isMyTurnToArrange={!currentPlayer.hasSubmitted}
          isLoading={isLoading}
        />
      )}
      {currentPlayer && currentPlayer.hasSubmitted && gameState.status === 'arranging' && (
         <p>你的牌已提交，等待其他玩家...</p>
      )}

      {(gameState.status === 'comparing' || gameState.status === 'finished_round') && (
        <div className="all-players-hands-display">
          <h3>比牌结果:</h3>
          {gameState.players.map(p => (
            <div key={p.id} className="player-info opponent-hand">
              <h4>{p.name} (总分: {p.score}) {p.id === playerId ? "(你)" : ""}</h4>
              {p.evaluatedHands?.isMisarranged && <p className="error-message" style={{textAlign:'center'}}>{getHandTypeName("MISARRANGED", p.evaluatedHands)}</p>}
              {p.evaluatedHands?.specialType && <p style={{textAlign:'center', color: '#ffeb3b'}}>特殊牌型: {getHandTypeName(p.evaluatedHands.specialType, p.evaluatedHands)}</p>}
              
              {p.arrangedHands ? (
                <>
                  <HandDisplay label="前墩" cards={p.arrangedHands.front} evaluation={p.evaluatedHands?.front} />
                  <HandDisplay label="中墩" cards={p.arrangedHands.middle} evaluation={p.evaluatedHands?.middle} />
                  <HandDisplay label="后墩" cards={p.arrangedHands.back} evaluation={p.evaluatedHands?.back} />
                </>
              ) : <p>等待 {p.name} 提交...</p>}
            </div>
          ))}
          {renderResults()}
        </div>
      )}
      
      {gameState.status === 'arranging' && otherPlayers.length > 0 && (
          <div className="other-players-summary">
            <h4>其他玩家:</h4>
            {otherPlayers.map(p => (
                <div key={p.id} className="player-info">
                    <p>{p.name}: {p.hasSubmitted ? "已提交" : "理牌中"} (总分: {p.score})</p>
                </div>
            ))}
          </div>
      )}

      {gameState.status === 'finished_round' && (
        <button onClick={handleNextRound} disabled={isLoading}>
            {isLoading ? "处理中..." : "开始下一局"}
        </button>
      )}
    </div>
  );
};

export default GameTable;
