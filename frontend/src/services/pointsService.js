import axios from 'axios';

const API_BASE_URL = 'https://9526.ip-ddns.com/api/points';

// 添加认证头
axios.interceptors.request.use(config => {
  const user = JSON.parse(localStorage.getItem('thirteenWaterUser'));
  if (user && user.id) {
    config.headers['Authorization'] = `Bearer ${user.id}`;
  }
  return config;
});

export const searchUserByMobile = async (mobile) => {
  try {
    const response = await axios.get(`${API_BASE_URL}?action=search_user&mobile=${mobile}`);
    return response.data.user;
  } catch (error) {
    throw new Error('搜索用户失败');
  }
};

export const transferPoints = async (toUserId, amount) => {
  try {
    const response = await axios.post(API_BASE_URL, {
      action: 'transfer',
      to_user_id: toUserId,
      amount: amount
    });
    return response.data;
  } catch (error) {
    throw new Error('转账失败');
  }
};
