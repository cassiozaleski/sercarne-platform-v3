import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('auth:user');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);

        // 🔒 NORMALIZAÇÃO CRÍTICA (evita loop)
        if (parsed?.role && parsed.role !== 'vendor' && parsed.role !== 'public') {
          parsed.role = 'vendor';
        }

        if (parsed?.role === 'vendor') {
          parsed.homePath = '/vendedor';
        }

        setUser(parsed);
      } catch {
        localStorage.removeItem('auth:user');
      }
    }
    setLoading(false);
  }, []);

  function login(userData) {
    // 🔒 NORMALIZAÇÃO CRÍTICA
    const safeUser = {
      ...userData,
      role: userData.role === 'public' ? 'public' : 'vendor',
      homePath: userData.role === 'public' ? '/cliente' : '/vendedor',
    };

    localStorage.setItem('auth:user', JSON.stringify(safeUser));
    setUser(safeUser);
  }

  function logout() {
    localStorage.removeItem('auth:user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
