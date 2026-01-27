
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, GamePhase, GameState, Player, PlayerRole, GameMode, HandType, User } from '../types';
import { generateDeck, shuffleDeck, shuffleDeckNoShuffle } from '../constants';
import { sortCards, determineHandType, canPlayHand, findMove } from '../utils/gameRules';
import { playTTS } from '../services/audioService';
import { tg } from './useTelegram';

const INITIAL_PLAYER_STATE: Player = {
  id: 0,
  name: "等待中...",
  hand: [],
  role: null,
  isHuman: true,
  passes: 0,
  isReady: false,
  uid: null
};

const INITIAL_GAME_STATE: GameState = {
  deck: [],
  players: [],
  phase: GamePhase.MainMenu,
  mode: GameMode.PvE,
  landlordCards: [],
  currentTurnIndex: 0,
  lastMove: null,
  winnerId: null,
  multiplier: 1,
  baseScore: 100,
  bidsCount: 0
};

export const useGameLogic = (currentUser: User | null, setCurrentUser: (u: User) => void) => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [myPlayerId, setMyPlayerId] = useState<number>(0);
  const [isMatching, setIsMatching] = useState(false);

  const pollIntervalRef = useRef<number | null>(null);
  const lastPollTimestamp = useRef<number>(0);
  const dealingDeckRef = useRef<Card[]>([]);
  const dealingIntervalRef = useRef<number | null>(null);

  /**
   * 关键改进：视角自动对齐 (Auto-Alignment)
   * 无论通过何种方式进入游戏，系统会实时对比 gameState.players 中的 uid 与当前用户的 telegram_id。
   * 一旦匹配成功，自动更新 myPlayerId，驱动 UI 将该玩家显示在正下方。
   */
  useEffect(() => {
    if (currentUser && gameState.players && gameState.players.length > 0) {
      const myTelegramId = String(currentUser.telegram_id);
      
      // 在当前房间的玩家列表中寻找自己
      const foundIdx = gameState.players.findIndex(p => p.uid && String(p.uid) === myTelegramId);
      
      if (foundIdx !== -1 && foundIdx !== myPlayerId) {
        console.log(`[ViewSync] Matched current user to player slot: ${foundIdx}`);
        setMyPlayerId(foundIdx);
      }
    }
  }, [gameState.players, currentUser, myPlayerId]);

  const stopPolling = useCallback(() => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
  }, []);

  const startPolling = useCallback((roomId: string) => {
      stopPolling();
      pollIntervalRef.current = window.setInterval(async () => {
          try {
              const res = await fetch('/api/game/sync', {
                  method: 'POST',
                  body: JSON.stringify({ action: 'poll', roomId })
              });
              const data = await res.json();
              if (data.success && data.state) {
                  if (data.timestamp > lastPollTimestamp.current) {
                      lastPollTimestamp.current = data.timestamp;
                      setGameState(data.state);
                  }
              }
          } catch (e) {
              console.error("Polling error", e);
          }
      }, 1500);
  }, [stopPolling]);

  const uploadGameState = async (newState: GameState) => {
      setGameState(newState); 
      if (newState.mode === GameMode.Friends && newState.roomId) {
          try {
              await fetch('/api/game/sync', {
                  method: 'POST',
                  body: JSON.stringify({
                      action: 'update',
                      roomId: newState.roomId,
                      payload: { newState }
                  })
              });
          } catch (e) {
              console.warn("Sync failed");
          }
      }
  };

  const handleCreateRoom = async () => {
      if (!currentUser) return;
      setIsMatching(true);
      const roomId = `room_${Math.floor(Math.random() * 89999) + 10000}`;
      try {
          const res = await fetch('/api/game/sync', {
              method: 'POST',
              body: JSON.stringify({
                  action: 'create',
                  roomId,
                  userId: currentUser.telegram_id,
                  username: currentUser.username
              })
          });
          const data = await res.json();
          if (data.success) {
              const newState = { ...data.state, roomId, mode: GameMode.Friends };
              setGameState(newState);
              setMyPlayerId(0); 
              startPolling(roomId);
          }
      } catch (e) {
          tg.showAlert("创建失败");
      } finally {
          setIsMatching(false);
      }
  };

  const handleJoinRoom = async (roomId: string) => {
      if (!currentUser) return;
      setIsMatching(true);
      try {
          const res = await fetch('/api/game/sync', {
              method: 'POST',
              body: JSON.stringify({
                  action: 'join',
                  roomId,
                  userId: currentUser.telegram_id,
                  username: currentUser.username
              })
          });
          const data = await res.json();
          if (data.success) {
              // 注意：这里设置 myPlayerId 是初始化的，后续会被上面的 useEffect 自动校准
              setMyPlayerId(data.playerId);
              const pollRes = await fetch('/api/game/sync', {
                   method: 'POST',
                   body: JSON.stringify({ action: 'poll', roomId })
              });
              const pollData = await pollRes.json();
              if (pollData.success) {
                  setGameState({ ...pollData.state, roomId, mode: GameMode.Friends });
                  startPolling(roomId);
              }
          } else {
              tg.showAlert(data.error || "房间不可用");
          }
      } catch (e) {
          tg.showAlert("连接失败");
      } finally {
          setIsMatching(false);
      }
  };

  const startDealing = (isNoShuffle: boolean, mode: GameMode = GameMode.PvE) => {
    if (!currentUser) return;
    const fullDeck = generateDeck();
    const deck = isNoShuffle ? shuffleDeckNoShuffle(fullDeck) : shuffleDeck(fullDeck);
    
    const p1Hand = deck.slice(0, 17);
    const p2Hand = deck.slice(17, 34);
    const p3Hand = deck.slice(34, 51);
    const leftovers = deck.slice(51, 54);
    
    const isPvE = mode === GameMode.PvE;
    
    let currentLobbyPlayers = gameState.players;
    if (currentLobbyPlayers.length < 3 || mode === GameMode.PvE) {
        currentLobbyPlayers = [
            { ...INITIAL_PLAYER_STATE, id: 0, name: currentUser.username, uid: currentUser.telegram_id, isReady: true },
            { ...INITIAL_PLAYER_STATE, id: 1, name: "电脑 (左)", uid: null, isHuman: !isPvE },
            { ...INITIAL_PLAYER_STATE, id: 2, name: "电脑 (右)", uid: null, isHuman: !isPvE }
        ];
    }

    const newPlayers: Player[] = [
      { ...currentLobbyPlayers[0], hand: sortCards(p1Hand) },
      { ...currentLobbyPlayers[1], hand: sortCards(p2Hand) },
      { ...currentLobbyPlayers[2], hand: sortCards(p3Hand) }
    ];

    if (mode === GameMode.Friends) {
        const biddingState: GameState = {
            ...INITIAL_GAME_STATE,
            mode,
            players: newPlayers,
            landlordCards: leftovers,
            phase: GamePhase.Bidding,
            currentTurnIndex: Math.floor(Math.random() * 3),
            roomId: gameState.roomId,
            baseScore: 100,
            multiplier: 1,
            bidsCount: 0,
            lastMove: null
        };
        uploadGameState(biddingState);
        playTTS("开始抢地主", "Aoede");
    } else {
        dealingDeckRef.current = [...deck]; 
        const animPlayers = newPlayers.map(p => ({...p, hand: []}));
        setGameState({
            ...INITIAL_GAME_STATE,
            mode,
            players: animPlayers,
            landlordCards: leftovers,
            phase: GamePhase.Dealing,
            currentTurnIndex: Math.floor(Math.random() * 3), 
            lastMove: null,
            multiplier: 1,
            baseScore: 100,
            bidsCount: 0
        });
    }
  };

  useEffect(() => {
    if (gameState.phase === GamePhase.Dealing) {
        let cardIndex = 0;
        const totalCardsToDeal = 51; 
        dealingIntervalRef.current = window.setInterval(() => {
            if (cardIndex >= totalCardsToDeal) {
                if (dealingIntervalRef.current) clearInterval(dealingIntervalRef.current);
                setGameState(prev => ({
                    ...prev,
                    phase: GamePhase.Bidding,
                    players: prev.players.map(p => ({...p, hand: sortCards(p.hand)}))
                }));
                playTTS("开始抢地主", "Aoede");
                return;
            }
            const cardToDeal = dealingDeckRef.current[cardIndex];
            const playerToReceive = cardIndex % 3;
            setGameState(prev => {
                const updatedPlayers = [...prev.players];
                updatedPlayers[playerToReceive] = {
                    ...updatedPlayers[playerToReceive],
                    hand: [...updatedPlayers[playerToReceive].hand, cardToDeal]
                };
                return { ...prev, players: updatedPlayers };
            });
            cardIndex++;
        }, 30); 
        return () => { if (dealingIntervalRef.current) clearInterval(dealingIntervalRef.current); };
    }
  }, [gameState.phase]);

  useEffect(() => {
    if (gameState.mode === GameMode.Friends && gameState.phase === GamePhase.RoomLobby && myPlayerId === 0) {
        const readyCount = gameState.players.filter(p => p.isReady).length;
        if (readyCount === 3) {
             startDealing(false, GameMode.Friends);
        }
    }
  }, [gameState.players, gameState.phase, gameState.mode, myPlayerId]);

  const handleBid = (claim: boolean) => {
    if (gameState.currentTurnIndex !== myPlayerId && gameState.mode === GameMode.Friends) return;

    const currentPlayerIdx = gameState.currentTurnIndex;
    const voice = currentPlayerIdx === 0 ? 'Aoede' : (currentPlayerIdx === 1 ? 'Puck' : 'Kore');
    playTTS(claim ? "叫地主!" : "不叫", voice);

    let newState = { ...gameState };
    if (claim) {
      const newPlayers = [...newState.players];
      newPlayers.forEach((p, idx) => p.role = idx === currentPlayerIdx ? PlayerRole.Landlord : PlayerRole.Peasant);
      newPlayers[currentPlayerIdx].hand = sortCards([...newPlayers[currentPlayerIdx].hand, ...newState.landlordCards]);
      newState.players = newPlayers;
      newState.phase = GamePhase.Playing;
      newState.currentTurnIndex = currentPlayerIdx;
      newState.lastMove = null;
    } else {
      const nextTurn = (newState.currentTurnIndex + 1) % 3;
      if (newState.bidsCount + 1 >= 3) {
        tg.showAlert("流局，重新发牌！");
        startDealing(false, gameState.mode);
        return;
      } else {
        newState.currentTurnIndex = nextTurn;
        newState.bidsCount += 1;
      }
    }
    if (gameState.mode === GameMode.Friends) uploadGameState(newState);
    else setGameState(newState);
  };

  const playTurn = (cardsToPlay: Card[]) => {
    const currentPlayerIdx = gameState.currentTurnIndex;
    const voice = currentPlayerIdx === 0 ? 'Aoede' : (currentPlayerIdx === 1 ? 'Puck' : 'Kore');
    const handInfo = determineHandType(cardsToPlay);
    let isValid = false;
    const isLeader = !gameState.lastMove || gameState.lastMove.playerId === currentPlayerIdx;
    
    if (cardsToPlay.length === 0) {
      if (!isLeader) { isValid = true; playTTS("不要", voice); }
    } else {
      if (handInfo.type !== HandType.Invalid) {
        if (isLeader) isValid = true;
        else if (gameState.lastMove) {
            const lastValue = determineHandType(gameState.lastMove.cards).value;
            isValid = canPlayHand(cardsToPlay, gameState.lastMove.cards, gameState.lastMove.type, lastValue);
        }
      }
    }

    if (isValid) {
      let newMultiplier = gameState.multiplier;
      if (handInfo.type === HandType.Bomb || handInfo.type === HandType.Rocket) newMultiplier *= 2;

      if (cardsToPlay.length > 0) {
        playTTS(handInfo.type === HandType.Single ? cardsToPlay[0].label : handInfo.type, voice);
      }

      const newPlayers = [...gameState.players];
      const currentPlayer = newPlayers[currentPlayerIdx];

      if (cardsToPlay.length > 0) {
        const playedIds = new Set(cardsToPlay.map(c => c.id));
        currentPlayer.hand = currentPlayer.hand.filter(c => !playedIds.has(c.id));
        currentPlayer.passes = 0;
      } else {
        currentPlayer.passes += 1;
      }

      if (currentPlayer.hand.length === 0) {
        playTTS(currentPlayer.id === myPlayerId ? "我赢啦！" : "你输了", "Aoede");
        const gameOverState = {
          ...gameState,
          players: newPlayers,
          phase: GamePhase.GameOver,
          winnerId: currentPlayerIdx,
          lastMove: { playerId: currentPlayerIdx, cards: cardsToPlay, type: handInfo.type },
          multiplier: newMultiplier
        };
        if (gameState.mode === GameMode.Friends) uploadGameState(gameOverState);
        else setGameState(gameOverState);
        return;
      }

      const newState = {
        ...gameState,
        players: newPlayers,
        lastMove: cardsToPlay.length > 0 ? { playerId: currentPlayerIdx, cards: cardsToPlay, type: handInfo.type } : gameState.lastMove,
        currentTurnIndex: (gameState.currentTurnIndex + 1) % 3,
        multiplier: newMultiplier
      };
      
      if (gameState.mode === GameMode.Friends) uploadGameState(newState);
      else setGameState(newState);
    } else {
      tg.showAlert("出牌不符合规则！");
    }
  };

  useEffect(() => {
    if (gameState.mode !== GameMode.PvE) return;
    if (gameState.phase !== GamePhase.Playing && gameState.phase !== GamePhase.Bidding) return;
    const player = gameState.players[gameState.currentTurnIndex];
    if (player?.isHuman) return;
    const timer = setTimeout(() => {
        if (gameState.phase === GamePhase.Bidding) handleBid(Math.random() < 0.3);
        else playTurn(findMove(player.hand, (!gameState.lastMove || gameState.lastMove.playerId === player.id) ? null : gameState.lastMove.cards) || []);
    }, 1200);
    return () => clearTimeout(timer);
  }, [gameState.phase, gameState.currentTurnIndex]);

  const resetGame = () => {
    setGameState(INITIAL_GAME_STATE);
    stopPolling();
  };

  return {
    gameState,
    myPlayerId,
    setMyPlayerId,
    isMatching,
    setIsMatching,
    startDealing,
    handleBid,
    playTurn,
    handleCreateRoom,
    handleJoinRoom,
    resetGame,
    stopPolling
  };
};
