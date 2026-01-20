
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { schlosserApi } from '@/services/schlosserApi';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [clientData, setClientData] = useState(null); // For authenticated client/vendor
  const [publicCity, setPublicCity] = useState(null); // For public user
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // ✅ Evita loop/pisca-pisca quando a planilha devolve um homePath que não bate com o role.
  // A UI pode ficar alternando /login <-> /rota protegida infinitamente.
  function getSafeHomePath_(u) {
    const role = String(u?.role || '').trim().toLowerCase();
    if (role === 'admin') return '/admin';
    if (role === 'gestorcomercial') return '/gestorcomercial';
    if (role === 'cliente_b2b') return '/cliente_b2b';
    if (role === 'cliente_b2c') return '/cliente_b2c';
    if (['vendor', 'vendedor', 'representantepj'].includes(role)) return '/vendedor';
    if (role === 'cliente' || role === 'public') return '/cliente';
    // fallback seguro
    return '/cliente';
  }

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = () => {
    try {
      const storedAuth = localStorage.getItem('schlosser_auth');
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth);
        if (Date.now() - (parsed.timestamp || 0) < 24 * 60 * 60 * 1000) {
          // ✅ evita loop de redirecionamento se a planilha estiver com homePath incompatível
          const safeHomePath = getSafeHomePath_(parsed);
          setUser({ ...parsed, homePath: safeHomePath });
        } else {
          localStorage.removeItem('schlosser_auth');
        }
      }
      
      const storedClient = localStorage.getItem('schlosser_client_data');
      if (storedClient) setClientData(JSON.parse(storedClient));

      const storedCity = localStorage.getItem('schlosser_public_city');
      if (storedCity) setPublicCity(JSON.parse(storedCity));

    } catch (error) {
      localStorage.removeItem('schlosser_auth');
    } finally {
      setLoading(false);
    }
  };

  // login interno via Google Sheets (aba USUARIOS) usando Vercel Function (/api/auth)
  // login público (sem senha) segue existindo.
  const login = async (mode, credentials = null) => {
    setLoading(true);
    try {
      // PUBLIC (sem autenticação)
      if (mode === 'public') {
        await schlosserApi.getProducts('public', null);
        const userData = {
          role: 'public',
          name: 'Visitante',
          homePath: '/cliente',
          timestamp: Date.now()
        };
        localStorage.setItem('schlosser_auth', JSON.stringify(userData));
        setUser(userData);
        toast({ title: "Bem-vindo!", description: `Acesso ao catálogo público liberado.` });
        return { success: true, user: userData };
      }

      // INTERNAL (valida na aba USUARIOS)
      const loginValue = credentials?.login;
      const passwordValue = credentials?.password;
      if (!loginValue || !passwordValue) throw new Error('Credenciais inválidas');

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginValue, password: passwordValue })
      });
      const out = await res.json();
      if (!out?.ok) throw new Error(out?.error || 'Credenciais inválidas');

      const u = out.user || {};
      // garante catálogo carregando (evita tela vazia)
      await schlosserApi.getProducts(u.role || 'vendor', null);

      const userData = {
        role: u.role || 'vendor',
        tipo: u.tipo || '',
        name: u.name || 'Usuário',
        login: u.login || loginValue,
        homePath: u.homePath || '/cliente',
        timestamp: Date.now()
      };

      // ✅ força um homePath compatível com o role (evita loop/pisca-pisca)
      userData.homePath = getSafeHomePath_(userData);

      localStorage.setItem('schlosser_auth', JSON.stringify(userData));
      setUser(userData);

      toast({ title: "Login realizado!", description: `Bem-vindo ao Schlosser Pro V9.` });
      return { success: true, user: userData };
    } catch (error) {
      toast({ title: "Erro no login", description: "Credenciais inválidas.", variant: "destructive" });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('schlosser_auth');
    localStorage.removeItem('schlosser_client_data');
    localStorage.removeItem('schlosser_public_city');
    setUser(null);
    setClientData(null);
    setPublicCity(null);
  };

  const selectClient = (client) => {
      setClientData(client);
      localStorage.setItem('schlosser_client_data', JSON.stringify(client));
  };

  const selectCity = (city) => {
      setPublicCity(city);
      localStorage.setItem('schlosser_public_city', JSON.stringify(city));
  };

  const value = {
    user,
    clientData,
    publicCity,
    loading,
    login,
    logout,
    selectClient,
    selectCity,
    isAuthenticated: !!user,
    isVendor: user?.role === 'vendor',
    isAdmin: user?.role === 'admin',
    isPublic: user?.role === 'public' || (!user), // Treat undefined as potentially public
    role: user?.role || 'public',
    userKey: user?.key
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
