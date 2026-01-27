
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, GamePhase, GameState, Player, PlayerRole, GameMode, HandType, User } from '../types';
import { generateDeck, shuffleDeck, shuffleDeckNoShuffle } from '../constants';
import { sortCards, determineHandType, canPlayHand, findMove } from '../utils/gameRules';
import { playTTS } from '../services/audioService';
import { tg } from './useTelegram';

const INITIAL_PLAYER_STATE: Player = {
  id: 0,
  name: "玩家",
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

  // Refs for logic
  const dealingDeckRef = useRef<Card[]>([]);
  const dealingIntervalRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const lastPollTimestamp = useRef<number>(0);

  // --- 自动视角修正 (Auto Rotate) ---
  // 确保我在 0 号位 (底部)，通过设置 myPlayerId 来偏移渲染
  useEffect(() => {
    if (currentUser && gameState.players.length > 0) {
      // 使用 weak comparison (==) 避免 string/number 类型不一致问题
      const me = gameState.players.find(p => p.uid == currentUser.telegram_id);
      if (me && me.id !== myPlayerId) {
        setMyPlayerId(me.id);
      }
    }
  }, [gameState.players, currentUser, myPlayerId]);


  // --- Network Sync Logic ---
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
                      setGameState(prevState => {
                          return data.state;
                      });
                  }
              }
          } catch (e) {
              console.error("Polling error", e);
          }
      }, 1500);
  }, [stopPolling]);

  const uploadGameState = async (newState: GameState) => {
      setGameState(newState); // Optimistic Update locally
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
              tg.showAlert("同步失败，请检查网络");
          }
      }
  };

  const handleCreateRoom = async () => {
      if (!currentUser) return;
      setIsMatching(true); // Reusing isMatching as isLoading
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
              setMyPlayerId(0); // 房主 ID 为 0
              startPolling(roomId);
          } else {
              tg.showAlert("创建房间失败");
          }
      } catch (e) {
          tg.showAlert("网络错误");
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
              tg.showAlert(data.error || "加入失败");
          }
      } catch (e) {
          tg.showAlert("网络错误");
      } finally {
          setIsMatching(false);
      }
  };

  // --- Dealing Logic ---
  const startDealing = (isNoShuffle: boolean, mode: GameMode = GameMode.PvE) => {
    if (!currentUser) return;
    const baseScore = 100;
    
    const fullDeck = generateDeck();
    const deck = isNoShuffle ? shuffleDeckNoShuffle(fullDeck) : shuffleDeck(fullDeck);
    
    // Distribute cards
    const p1Hand = deck.slice(0, 17);
    const p2Hand = deck.slice(17, 34);
    const p3Hand = deck.slice(34, 51);
    const leftovers = deck.slice(51, 54);
    
    const isPvE = mode === GameMode.PvE;
    
    // 继承大厅中的玩家信息 (UID, Name)
    // 关键：确保游戏开始后 UID 不丢失，以便 AutoRotate 继续工作
    let currentLobbyPlayers = gameState.players;
    if (currentLobbyPlayers.length < 3 || mode === GameMode.PvE) {
        // 如果是 PVE 或数据不全，使用默认/虚拟填充
        const myName = currentUser.username;
        currentLobbyPlayers = [
            { ...INITIAL_PLAYER_STATE, id: 0, name: myName, uid: currentUser.telegram_id },
            { ...INITIAL_PLAYER_STATE, id: 1, name: "电脑 (左)", uid: null },
            { ...INITIAL_PLAYER_STATE, id: 2, name: "电脑 (右)", uid: null }
        ];
    }

    const newPlayers: Player[] = [
      { ...INITIAL_PLAYER_STATE, id: 0, name: currentLobbyPlayers[0].name, uid: currentLobbyPlayers[0].uid, isHuman: true, hand: sortCards(p1Hand) },
      { ...INITIAL_PLAYER_STATE, id: 1, name: currentLobbyPlayers[1].name, uid: currentLobbyPlayers[1].uid, isHuman: isPvE ? false : true, hand: sortCards(p2Hand) },
      { ...INITIAL_PLAYER_STATE, id: 2, name: currentLobbyPlayers[2].name, uid: currentLobbyPlayers[2].uid, isHuman: isPvE ? false : true, hand: sortCards(p3Hand) }
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
            baseScore,
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
            baseScore,
            bidsCount: 0
        });
    }
  };

  // Dealing Animation Effect (PvE Only)
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

  // --- Auto Start Logic (Friends) ---
  useEffect(() => {
    if (gameState.mode === GameMode.Friends && gameState.phase === GamePhase.RoomLobby && myPlayerId === 0) {
        const readyCount = gameState.players.filter(p => p.isReady).length;
        if (readyCount === 3) {
             startDealing(false, GameMode.Friends);
        }
    }
  }, [gameState.players, gameState.phase, gameState.mode, myPlayerId]);


  // --- Game Actions ---
  const getVoiceForPlayer = (playerIdx: number) => {
     if (playerIdx === 0) return 'Aoede'; 
     if (playerIdx === 1) return 'Puck'; 
     return 'Kore'; 
  };

  const handleBid = (claim: boolean) => {
    if (gameState.currentTurnIndex !== myPlayerId && gameState.mode === GameMode.Friends) return;

    const currentPlayerIdx = gameState.currentTurnIndex;
    const voice = getVoiceForPlayer(currentPlayerIdx);
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
    const voice = getVoiceForPlayer(currentPlayerIdx);
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
      if (handInfo.type === HandType.Bomb) newMultiplier *= 2;
      if (handInfo.type === HandType.Rocket) newMultiplier *= 2;

      if (cardsToPlay.length > 0) {
        if (handInfo.type === HandType.Single) playTTS(cardsToPlay[0].label, voice);
        else if (handInfo.type === HandType.Pair) playTTS(`一对 ${cardsToPlay[0].label}`, voice);
        else if (handInfo.type === HandType.Bomb) playTTS("炸弹!", voice);
        else if (handInfo.type === HandType.Rocket) playTTS("王炸!", voice);
        else playTTS(handInfo.type, voice);
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

      // Check Win
      if (currentPlayer.hand.length === 0) {
        playTTS(currentPlayer.id === myPlayerId ? "我赢啦！" : "你输了", "Aoede");
        
        const finalScore = gameState.baseScore * newMultiplier;
        if (currentUser && gameState.mode === GameMode.PvE) {
            const myRole = newPlayers[myPlayerId].role;
            const winnerRole = currentPlayer.role;
            const amIWinner = (myRole === winnerRole); 
            let scoreChange = 0;
            if (myRole === PlayerRole.Landlord) scoreChange = amIWinner ? (finalScore * 2) : -(finalScore * 2);
            else scoreChange = amIWinner ? finalScore : -finalScore;
            setCurrentUser({ ...currentUser, points: currentUser.points + scoreChange });
        }

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

  // --- Bot Logic ---
  useEffect(() => {
    if (gameState.mode !== GameMode.PvE) return;
    if (gameState.phase !== GamePhase.Playing && gameState.phase !== GamePhase.Bidding) return;
    
    const player = gameState.players[gameState.currentTurnIndex];
    if (player.isHuman) return;

    const timer = setTimeout(() => {
        if (gameState.phase === GamePhase.Bidding) {
            handleBid(Math.random() < 0.4);
        } else {
            const isLeader = !gameState.lastMove || gameState.lastMove.playerId === player.id;
            const lastCards = isLeader ? null : gameState.lastMove?.cards || null;
            const move = findMove(player.hand, lastCards);
            playTurn(move || []);
        }
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
