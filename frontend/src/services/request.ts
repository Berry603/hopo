import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';

// 通用响应类型
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

// 通用分页类型
export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 用户信息类型
export interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  avatar?: string;
  email?: string;
  role: string;
}

// 登录响应类型
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: UserInfo;
}

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动注入 token
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：统一数据提取 & 错误处理
// 后端返回格式: { code: 200, message: "成功", data: [...] }
// 拦截器自动将 response.data 替换为内层的 data 字段
// 页面使用时: res.data 直接拿到业务数据（数组/对象）
request.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse;
    
    // 业务错误检查
    if (body.code !== undefined && body.code !== 200 && body.code !== 201) {
      message.error(body.message || '请求失败');
      return Promise.reject(new Error(body.message || '请求失败'));
    }
    
    // 统一提取：将 response.data 替换为内层 data 字段
    // 这样所有页面 const res = await getXxx() 后，res.data 直接就是业务数据
    if (body.code !== undefined && body.data !== undefined) {
      response.data = body.data;
    }
    
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 401:
          // token 过期或未授权，清除 token 并跳转登录
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          message.error('登录已过期，请重新登录');
          // 避免在登录页本身也触发跳转
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          break;
        case 403:
          message.error('没有权限执行此操作');
          break;
        case 404:
          message.error('请求的资源不存在');
          break;
        case 500:
          message.error('服务器错误，请稍后重试');
          break;
        default:
          message.error(`请求失败 (${status})`);
      }
    } else if (error.code === 'ECONNABORTED') {
      message.error('请求超时，请检查网络连接');
    } else {
      message.error('网络错误，请检查网络连接');
    }
    return Promise.reject(error);
  }
);

export default request;
