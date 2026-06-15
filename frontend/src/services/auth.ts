import request, { ApiResponse, LoginResponse, UserInfo } from './request';

/**
 * 登录
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await request.post<LoginResponse>('/auth/login', {
    username,
    password,
  });
  return response.data;
}

/**
 * 获取当前用户信息
 */
export async function getMe(): Promise<UserInfo> {
  const response = await request.get<UserInfo>('/auth/me');
  return response.data;
}

/**
 * 刷新 token
 */
export async function refreshToken(): Promise<{ access_token: string; refresh_token: string }> {
  const refreshTokenStr = localStorage.getItem('refresh_token');
  const response = await request.post<{ access_token: string; refresh_token: string }>(
    '/auth/refresh',
    { refresh_token: refreshTokenStr }
  );
  return response.data;
}
