import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { api } from '../api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (credential: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      // Optimistically restore user from localStorage for fast initial render
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          if (isMounted) setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem('user');
        }
      }

      // Validate session against server (uses HttpOnly cookies)
      try {
        const response = await api.get('/v2/auth/me');
        if (!isMounted) return;
        const serverUser: User = response.data.user;
        setUser(serverUser);
        localStorage.setItem('user', JSON.stringify(serverUser));
      } catch (err) {
        if (!isMounted) return;
        // Session invalid or network error – clear any stale localStorage data.
        // Routes remain on the loading spinner until setIsLoading(false) below,
        // so no incorrect content is shown between the optimistic set and this clear.
        console.warn('Session validation failed, logging out:', err);
        setUser(null);
        localStorage.removeItem('user');
      }

      if (isMounted) setIsLoading(false);
    };

    initializeAuth();
    return () => { isMounted = false; };
  }, []);

  const login = async (credential: string) => {
    try {
      const response = await axios.post('/api/v2/auth/google', {
        credential
      });

      const { user: userData } = response.data;

      setUser(userData);

      // Store in localStorage
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
