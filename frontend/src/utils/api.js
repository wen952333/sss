// frontend/src/utils/api.js
import axios from 'axios';

const API_BASE_URL = 'https://9526.ip-ddns.com/super_simple_cors_test.php'; // <--- TEMPORARY CHANGE

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Helper to get player ID from localStorage
const getPlayerId = () => localStorage.getItem('十三水_playerId');
const setPlayerId = (id) => localStorage.setItem('十三水_playerId', id);

export const createGame = async (playerName) => {
    let playerId = getPlayerId();
    if (!playerId) {
        playerId = `p_${Date.now()}${Math.random().toString(36).substring(2, 7)}`;
        setPlayerId(playerId);
    }
    const response = await apiClient.post(`?action=createGame`, { playerName, playerId });
    if (response.data.success && response.data.playerId) {
        setPlayerId(response.data.playerId); // Ensure we use the ID confirmed by backend
    }
    return response.data;
};

export const joinGame = async (gameId, playerName) => {
    let playerId = getPlayerId();
    if (!playerId) {
        playerId = `p_${Date.now()}${Math.random().toString(36).substring(2, 7)}`;
        setPlayerId(playerId);
    }
    const response = await apiClient.post(`?action=joinGame&gameId=${gameId}`, { playerName, playerId });
    if (response.data.success && response.data.playerId) {
        setPlayerId(response.data.playerId);
    }
    return response.data;
};

export const getGameState = async (gameId) => {
    const response = await apiClient.get(`?action=getGameState&gameId=${gameId}`);
    return response.data;
};

export const startGameApi = async (gameId) => {
    const playerId = getPlayerId();
    const response = await apiClient.post(`?action=startGame&gameId=${gameId}`, { playerId });
    return response.data;
};

export const submitHandApi = async (gameId, arrangedHands) => {
    const playerId = getPlayerId();
    // arrangedHands = { front: ["AS", "KC"], middle: [...], back: [...] }
    const response = await apiClient.post(`?action=submitHand&gameId=${gameId}&playerId=${playerId}`, arrangedHands);
    return response.data;
};

export const nextRoundApi = async (gameId) => {
    const playerId = getPlayerId();
    const response = await apiClient.post(`?action=nextRound&gameId=${gameId}`, { playerId });
    return response.data;
}

// Function to map card string (e.g., "AS", "TC") to image path
// Matches backend Card::getImageUrl() logic
export const getCardImageUrl = (cardString) => {
    if (!cardString || cardString.length < 2) return 'cards/blank.svg'; // Fallback
    const suit = cardString.slice(-1);
    const rank = cardString.slice(0, -1);

    const rankMap = {
        'A': 'ace', 'K': 'king', 'Q': 'queen', 'J': 'jack', 'T': '10',
        '9': '9', '8': '8', '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2'
    };
    const suitMap = {
        'S': 'spades', 'H': 'hearts', 'D': 'diamonds', 'C': 'clubs'
    };
    if (!rankMap[rank] || !suitMap[suit]) {
        console.warn("Invalid card string for image:", cardString);
        return 'cards/blank.svg';
    }
    return `/cards/${rankMap[rank]}_of_${suitMap[suit]}.svg`; // Vite serves from public dir directly
};

// Helper for displaying hand types nicely
export const getHandTypeName = (typeKey, handDetails) => {
    const names = {
        HIGH_CARD: '高牌',
        PAIR: '对子',
        TWO_PAIR: '两对',
        THREE_OF_A_KIND: '三条',
        STRAIGHT: '顺子',
        FLUSH: '同花',
        FULL_HOUSE: '葫芦',
        FOUR_OF_A_KIND: '铁支',
        STRAIGHT_FLUSH: '同花顺',
        MISARRANGED: '倒水!',
        ROYAL_DRAGON: '至尊清龙!',
        DRAGON: '一条龙!',
        SIX_PAIRS_PLUS: '六对半!',
        // Add more thirteen water special names here
    };
    if (handDetails && handDetails.isMisarranged) return names.MISARRANGED;
    if (handDetails && handDetails.specialType && names[handDetails.specialType]) return names[handDetails.specialType];
    return names[typeKey] || typeKey;
};
