import axios from 'axios';

const API_BASE_URL = 'https://9526.ip-ddns.com/api/game';

// 添加请求拦截器处理认证
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

// 其他游戏相关API函数...
