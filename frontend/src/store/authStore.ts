import { create } from 'zustand';
import { login as loginApi, getMe as getMeApi } from '../services/auth';
import type { UserInfo } from '../services/request';

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  isLoggedIn: !!localStorage.getItem('access_token'),
  loading: false,

  login: async (username: string, password: string) => {
    set({ loading: true });
    try {
      const result = await loginApi(username, password);
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('refresh_token', result.refresh_token);
      set({
        user: result.user,
        token: result.access_token,
        isLoggedIn: true,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({
      user: null,
      token: null,
      isLoggedIn: false,
    });
    window.location.href = '/login';
  },

  initAuth: async () => {
    const token = get().token;
    if (!token) {
      set({ isLoggedIn: false, user: null });
      return;
    }
    try {
      const user = await getMeApi();
      set({ user, isLoggedIn: true });
    } catch {
      // token 无效，清除登录态
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({
        user: null,
        token: null,
        isLoggedIn: false,
      });
    }
  },
}));
