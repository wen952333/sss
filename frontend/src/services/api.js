import axios from 'axios';

const api = axios.create({
  baseURL: 'https://9526.ip-ddns.com/api',
  withCredentials: true,
});

// 请求拦截器
api.interceptors.request.use(config => {
  const user = JSON.parse(localStorage.getItem('thirteenWaterUser'));
  if (user && user.id) {
    config.headers['Authorization'] = `Bearer ${user.id}`;
  }
  return config;
});

// 响应拦截器
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      // 处理未授权
      localStorage.removeItem('thirteenWaterUser');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export default api;
