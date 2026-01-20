
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Key, LogIn, ShoppingBag, Lock, UserCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user, role } = useAuth();
  const [selectedRole, setSelectedRole] = useState('public'); // public | internal
  const [loginValue, setLoginValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const target = user?.homePath || (role === 'admin' ? '/admin' : (role === 'vendor' ? '/vendedor' : '/cliente'));
      navigate(target);
    }
  }, [isAuthenticated, role, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = selectedRole === 'public'
      ? await login('public')
      : await login('internal', { login: loginValue, password: passwordValue });
    
    if (result.success) {
      // Navigation happens in useEffect
    } else {
      setLoading(false);
    }
  };

  const backgroundImage = 'https://images.unsplash.com/photo-1641680635975-7746d26e6abf';

  return (
    <>
      <Helmet>
        <title>Login - Sistema Schlosser</title>
        <meta name="description" content="Página de login para o Sistema Schlosser." />
      </Helmet>
      
      {/* Full-screen background with overlay */}
      <div 
        className="relative min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        {/* Semi-transparent dark overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-50 z-10"></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md relative z-20"
        >
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border-t-4 border-[#FF8C42]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-xl bg-[#FF8C42] mx-auto mb-4 flex items-center justify-center transform rotate-3 shadow-lg">
                <ShoppingBag className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sistema de Vendas</h1>
              <p className="text-sm mt-1 text-gray-500">Selecione seu perfil de acesso</p>
            </div>

            {/* Role Selection Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setSelectedRole('public')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  selectedRole === 'public'
                    ? 'bg-white text-[#FF8C42] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Cliente
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('internal')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  selectedRole === 'internal'
                    ? 'bg-white text-[#FF8C42] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Colaborador
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Dynamic Content based on Role */}
              <div className="min-h-[100px] flex flex-col justify-center">
                {selectedRole === 'public' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <UserCircle className="w-10 h-10 text-[#FF8C42] mx-auto mb-2" />
                    <p className="text-gray-700 font-medium">Acesso ao Catálogo Público</p>
                    <p className="text-xs text-gray-500 mt-1">Nenhuma senha necessária</p>
                  </motion.div>
                )}

                {selectedRole === 'internal' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Login</label>
                    <div className="relative mb-3">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={loginValue}
                        onChange={(e) => setLoginValue(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 transition-all outline-none text-gray-900 placeholder-gray-500"
                        placeholder="Seu login (nome ou telefone)..."
                        required
                      />
                    </div>

                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-xl focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 transition-all outline-none text-gray-900 placeholder-gray-500"
                        placeholder="Senha / token..."
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#FF8C42] hover:bg-[#E67E22] text-white py-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verificando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    Entrar no Sistema <LogIn className="ml-2 w-5 h-5" />
                  </span>
                )}
              </Button>
            </form>
          </div>
          
          <div className="text-center mt-6">
            <p className="text-gray-200 text-xs">
              © 2026 Sistema Schlosser. Todos os direitos reservados.
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;
