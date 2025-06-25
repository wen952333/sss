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
    // 确保响应包含用户数据
    if (response.data && response.data.user) {
      return response.data.user;
    } else {
      throw new Error(response.data && response.data.message ? response.data.message : '注册成功但未返回用户数据');
    }
  } catch (error) {
    let errorMessage = '注册失败';
    if (error.response) {
      if (error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      } else {
        errorMessage = `服务器错误: ${error.response.status}`;
      }
    } else if (error.request) {
      errorMessage = '无法连接到服务器';
    }
    throw new Error(errorMessage);
  }
};
