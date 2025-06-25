import axios from 'axios';

const API_BASE_URL = 'https://9526.ip-ddns.com/api/game';

axios.interceptors.request.use(config => {
  const user = JSON.parse(localStorage.getItem('thirteenWaterUser'));
  if (user && user.id) {
    config.headers['Authorization'] = `Bearer ${user.id}`;
  }
  return config;
});

export const getRooms = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}?action=get_rooms`);
    return response.data.rooms;
  } catch (error) {
    throw new Error('获取房间列表失败');
  }
};

export const createRoom = async (roomName) => {
  try {
    const response = await axios.post(API_BASE_URL, {
      action: 'create_room',
      name: roomName
    });
    return response.data;
  } catch (error) {
    throw new Error('创建房间失败');
  }
};

export const joinRoom = async (roomId) => {
  try {
    const response = await axios.post(API_BASE_URL, {
      action: 'join_room',
      room_id: roomId
    });
    return response.data;
  } catch (error) {
    throw new Error('加入房间失败');
  }
};

export const getRoomDetails = async (roomId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}?action=get_room&room_id=${roomId}`);
    return response.data.room;
  } catch (error) {
    throw new Error('获取房间详情失败');
  }
};

export const leaveRoom = async (roomId) => {
  try {
    const response = await axios.post(API_BASE_URL, {
      action: 'leave_room',
      room_id: roomId
    });
    return response.data;
  } catch (error) {
    throw new Error('离开房间失败');
  }
};

export const startGame = async (roomId) => {
  try {
    const response = await axios.post(API_BASE_URL, {
      action: 'start_game',
      room_id: roomId
    });
    return response.data;
  } catch (error) {
    throw new Error('开始游戏失败');
  }
};

export const playCards = async (roomId, cardIndices) => {
  try {
    const response = await axios.post(API_BASE_URL, {
      action: 'play_cards',
      room_id: roomId,
      card_indices: cardIndices
    });
    return response.data;
  } catch (error) {
    throw new Error('出牌失败');
  }
};
