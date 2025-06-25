import axios from 'axios';

const API_BASE_URL = 'https://9526.ip-ddns.com/api/auth';

export const loginUser = async (mobile, password) => {
  try {
    const response = await axios.post(API_BASE_URL, {
      action: 'login',
      mobile,
      password
    });
    return response.data.user;
  } catch (error) {
    throw new Error('登录失败');
  }
};

export const registerUser = async (mobile, nickname, password) => {
  try {
    const response = await axios.post(API_BASE_URL, {
      action: 'register',
      mobile,
      nickname,
      password
    });
    return response.data.user;
  } catch (error) {
    throw new Error('注册失败');
  }
};
