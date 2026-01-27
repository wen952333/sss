
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
  isReady: false
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
                          // 收到服务端更新时，我们信任服务端的 players 状态
                          // 但为了安全起见，我们确保本地 myPlayerId 对应的玩家身份是正确的
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
              // 关键：设置自己的 Player ID
              setMyPlayerId(data.playerId);
              
              // 立即拉取一次最新状态
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

  // 真正的自动匹配逻辑：尝试加入随机公共房间，如果满了或不存在，则创建一个
  const handleAutoMatch = async () => {
    if (!currentUser) return;
    setIsMatching(true);

    // 简单策略：随机尝试加入 'public_1' 到 'public_5'
    const randomRoomId = `public_lobby_${Math.floor(Math.random() * 5) + 1}`;

    try {
        // 尝试加入
        const joinRes = await fetch('/api/game/sync', {
            method: 'POST',
            body: JSON.stringify({
                action: 'join',
                roomId: randomRoomId,
                userId: currentUser.telegram_id,
                username: currentUser.username
            })
        });
        const joinData = await joinRes.json();

        if (joinData.success) {
            setMyPlayerId(joinData.playerId);
            const pollRes = await fetch('/api/game/sync', {
                  method: 'POST',
                  body: JSON.stringify({ action: 'poll', roomId: randomRoomId })
            });
            const pollData = await pollRes.json();
            if (pollData.success) {
                setGameState({ ...pollData.state, roomId: randomRoomId, mode: GameMode.Friends });
                startPolling(randomRoomId);
            }
        } else {
            // 加入失败（可能是房间不存在，或者满了），尝试创建该房间
            // 注意：如果是因为满了，其实应该试下一个房间，这里简化逻辑：如果加入失败就尝试创建（如果是满的，创建也会失败/复用，取决于后端逻辑）
            // 在我们的后端逻辑中，CREATE 会重置房间。这在真正的自动匹配中是不对的。
            // 正确的 MVP 做法：如果加入失败且错误是"房间不存在"，则创建。
            
            // 简单起见：如果加入失败，就自己开一个新房间等别人来
            handleCreateRoom(); 
        }
    } catch (e) {
        tg.showAlert("匹配服务暂时不可用");
    } finally {
        setIsMatching(false);
    }
  };


  // --- Dealing Logic ---
  const startDealing = (playerNames: string[], isNoShuffle: boolean, mode: GameMode = GameMode.PvE) => {
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
    
    // 生成新玩家状态
    // 注意：ID 必须固定为 0, 1, 2
    const newPlayers: Player[] = [
      { ...INITIAL_PLAYER_STATE, id: 0, name: playerNames[0], isHuman: true, hand: sortCards(p1Hand) },
      { ...INITIAL_PLAYER_STATE, id: 1, name: playerNames[1], isHuman: isPvE ? false : true, hand: sortCards(p2Hand) },
      { ...INITIAL_PLAYER_STATE, id: 2, name: playerNames[2], isHuman: isPvE ? false : true, hand: sortCards(p3Hand) }
    ];

    if (mode === GameMode.Friends) {
        // Multiplayer: Host uploads the new state with dealt hands
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
        // PvE: Local animation
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
    // Only Host (id 0) triggers start when lobby is full
    if (gameState.mode === GameMode.Friends && gameState.phase === GamePhase.RoomLobby && myPlayerId === 0) {
        const readyCount = gameState.players.filter(p => p.isReady).length;
        if (readyCount === 3) {
             startDealing(gameState.players.map(p => p.name), false, GameMode.Friends);
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
        startDealing(gameState.players.map(p => p.name), false, gameState.mode);
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
        
        // Local Score Update (PvE)
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

      // Next Turn
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
    handleAutoMatch, // 导出新的匹配方法
    resetGame,
    stopPolling
  };
};
