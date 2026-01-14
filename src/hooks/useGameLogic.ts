
import { useState } from 'react';
import { Card, GamePhase, GameState, Seat } from '../types';
import { getLocalSuggestions, isValidArrangement } from '../services/suggestions';
import { getCarriage } from '../services/mockBackend';
import { ServerSeat } from './useSeats';

interface GameLogicProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    occupiedSeats: ServerSeat[];
    setOccupiedSeats: React.Dispatch<React.SetStateAction<ServerSeat[]>>;
    syncUserData: () => Promise<any>;
    setShowAuthModal: (view: 'login') => void;
    fetchSeats: () => Promise<void>;
    lobbyTables: any[];
}

export const useGameLogic = ({
    gameState,
    setGameState,
    occupiedSeats,
    setOccupiedSeats,
    syncUserData,
    setShowAuthModal,
    fetchSeats,
    lobbyTables
}: GameLogicProps) => {
    const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
    const [lobbySelection, setLobbySelection] = useState<{carriageId: number, seat: Seat} | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Seating ---

    const handleSeatSelect = async (carriageId: number, seat: Seat) => {
        if (!gameState.user) {
            setShowAuthModal('login');
            return;
        }

        const currentUser = await syncUserData();
        const currentPoints = currentUser?.points || 0;
        
        const tableConfig = lobbyTables.find(t => t.carriageId === carriageId);
        const minScore = tableConfig ? tableConfig.minScore : 100; 

        if (currentPoints < minScore) {
            alert(`您的积分 (${currentPoints}) 不足 ${minScore}，无法入座。\n请联系管理员或好友获取积分。`);
            return;
        }

        if (lobbySelection?.carriageId === carriageId && lobbySelection?.seat === seat) {
            setLobbySelection(null);
            return;
        }

        setLobbySelection({ carriageId, seat });
    };

    const handleLeaveSeat = async () => {
        if (!gameState.user) return;
        setLobbySelection(null);
        try {
            await fetch('/api/game/seat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    action: 'leave',
                    userId: gameState.user.id
                })
            });
            fetchSeats();
        } catch(e) { console.error(e); }
    };

    const handleEnterGame = async () => {
        if (!lobbySelection) return;
        if (!gameState.user) {
            setShowAuthModal('login');
            return;
        }

        const { carriageId, seat } = lobbySelection;
        
        // Optimistic Seat Taking
        try {
            const res = await fetch('/api/game/seat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    carriageId,
                    seat,
                    userId: gameState.user.id,
                    nickname: gameState.user.nickname,
                    action: 'join'
                })
            });
            
            if (!res.ok) {
                const data = await res.json() as any;
                alert(data.error || "入座失败，位置可能已被抢占");
                setLobbySelection(null); 
                fetchSeats();
                return;
            }
            
            const data = await res.json() as any;
            fetchSeats();
            
            // Start Game Logic
            const deckIdToFetch = (data.joinedRound % 20) || 20; 
            const carriageMockData = getCarriage(deckIdToFetch); 
            
            if (!carriageMockData) return alert("System Error: Local Carriage Data not found");

            const queue = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
            
            const firstTableId = queue[0];
            const cards = carriageMockData.tables[firstTableId].hands[seat];
            const suggestions = getLocalSuggestions(cards);

            setGameState(prev => ({
              ...prev,
              phase: GamePhase.PLAYING,
              currentCarriageId: carriageId,
              currentRound: data.joinedRound || 1, 
              currentTableIndex: 0,
              tableQueue: queue,
              mySeat: seat, 
              currentCards: cards,
              currentArrangement: suggestions[0],
              aiSuggestions: suggestions,
              currentSuggestionIndex: 0
            }));
            setSelectedCardIds([]);

        } catch (e) {
            console.error(e);
            alert("网络错误");
        }
    };

    const handleQuitGame = async () => {
        await handleLeaveSeat();
        setGameState(prev => ({ ...prev, phase: GamePhase.LOBBY }));
    };

    // --- Card Interaction ---

    const handleCardClick = (card: Card) => {
        if (gameState.phase !== GamePhase.PLAYING) return;
        setSelectedCardIds(prev => prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]);
    };

    const handleRowClick = (targetSegment: 'top' | 'middle' | 'bottom') => {
        if (gameState.phase !== GamePhase.PLAYING || selectedCardIds.length === 0) return;

        setGameState(prev => {
            const currentArrangement = prev.currentArrangement;
            const newArrangement = { top: [...currentArrangement.top], middle: [...currentArrangement.middle], bottom: [...currentArrangement.bottom] };
            const cardsToMove: Card[] = [];

            (['top', 'middle', 'bottom'] as const).forEach(key => {
                const staying = [];
                for (const card of newArrangement[key]) {
                    if (selectedCardIds.includes(card.id)) cardsToMove.push(card);
                    else staying.push(card);
                }
                newArrangement[key] = staying;
            });

            newArrangement[targetSegment] = [...newArrangement[targetSegment], ...cardsToMove];
            return { ...prev, currentArrangement: newArrangement };
        });
        setSelectedCardIds([]);
    };

    const handleSmartArrange = () => {
        if (gameState.aiSuggestions.length === 0) return;
        const nextIndex = (gameState.currentSuggestionIndex + 1) % gameState.aiSuggestions.length;
        setGameState(prev => ({
            ...prev,
            currentSuggestionIndex: nextIndex,
            currentArrangement: prev.aiSuggestions[nextIndex]
        }));
        setSelectedCardIds([]);
    };

    // Shared submission logic
    const processSubmission = async (shouldExit: boolean) => {
        if (!gameState.user) return alert("请先登录");
        if (isSubmitting) return;

        const { top, middle, bottom } = gameState.currentArrangement;
        if (top.length !== 3 || middle.length !== 5 || bottom.length !== 5) {
            alert("请确保头墩3张、中墩5张、尾墩5张！");
            return;
        }

        const validation = isValidArrangement(gameState.currentArrangement);
        if (!validation.valid) {
            alert(`牌型违规: ${validation.error}`);
            return;
        }

        setIsSubmitting(true);
        const currentTableId = gameState.tableQueue[gameState.currentTableIndex];
        
        let jumpToRound: number | null = null;

        try {
            const res = await fetch('/api/game/submit', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    carriageId: gameState.currentCarriageId,
                    roundId: gameState.currentRound,
                    tableId: currentTableId,
                    userId: gameState.user.id,
                    seat: gameState.mySeat,
                    hand: gameState.currentArrangement
                })
            });
            const data = await res.json() as any;
            if (data.jumpToRound) {
                jumpToRound = data.jumpToRound;
            }
            
            // Mock sync for local view (optional, but good for instant feedback if offline mode supported)
            // But since we are full API now, we rely on state updates below

        } catch (e) {
            console.error("Submission failed", e);
            alert("提交失败，请重试");
            setIsSubmitting(false);
            return;
        }

        // --- BRANCH: EXIT ---
        if (shouldExit) {
            await handleLeaveSeat();
            setGameState(prev => ({ ...prev, phase: GamePhase.SETTLEMENT_VIEW, settlementReport: null }));
            setIsSubmitting(false);
            return;
        }

        // --- BRANCH: CONTINUE ---
        
        let nextRound = gameState.currentRound;
        let nextTableIndex = gameState.currentTableIndex + 1;
        let queue = gameState.tableQueue;

        // CHECK 1: FORCE JUMP (Lagging player catches up)
        if (jumpToRound && jumpToRound > nextRound) {
            // Reset to Table 0 of the NEW round
            nextRound = jumpToRound;
            nextTableIndex = 0;
            // Regenerate queue for new round
            queue = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
            console.log(`Syncing: Jumping to Round ${nextRound}`);
        } 
        // CHECK 2: Standard Round Transition
        else if (nextTableIndex >= 10) {
            nextRound = gameState.currentRound + 1;
            nextTableIndex = 0;
            queue = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
            
            // Notify server of natural progression
            try {
                fetch('/api/game/seat', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        action: 'next_round', 
                        userId: gameState.user.id, 
                        carriageId: gameState.currentCarriageId, 
                        seat: gameState.mySeat, 
                        nextRound: nextRound 
                    })
                }).catch(()=>{});
            } catch(e) {}
        }

        // Load Next Cards
        const nextDeckId = (nextRound % 20) || 20; 
        const carriageMockData = getCarriage(nextDeckId); 
        
        if (!carriageMockData) {
            alert("系统错误：牌组加载失败");
            await handleLeaveSeat();
            setGameState(prev => ({ ...prev, phase: GamePhase.SETTLEMENT_VIEW, settlementReport: null }));
            setIsSubmitting(false);
            return;
        }

        const firstTableId = queue[nextTableIndex];
        const nextCards = carriageMockData.tables[firstTableId].hands[gameState.mySeat];
        const suggestions = getLocalSuggestions(nextCards);

        setGameState(prev => ({
            ...prev,
            currentRound: nextRound,
            currentTableIndex: nextTableIndex,
            tableQueue: queue,
            currentCards: nextCards,
            currentArrangement: suggestions[0],
            aiSuggestions: suggestions,
            currentSuggestionIndex: 0
        }));

        setSelectedCardIds([]);
        setIsSubmitting(false);
    };

    const submitHand = () => processSubmission(false);
    const submitAndExit = () => processSubmission(true);

    return {
        selectedCardIds,
        lobbySelection,
        isSubmitting,
        handleSeatSelect,
        handleLeaveSeat,
        handleEnterGame,
        handleQuitGame,
        handleCardClick,
        handleRowClick,
        handleSmartArrange,
        submitHand,
        submitAndExit, 
        setLobbySelection
    };
};
