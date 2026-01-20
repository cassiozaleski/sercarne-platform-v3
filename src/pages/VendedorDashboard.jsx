import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Package, ShoppingCart, Loader2, Save, User, Users } from 'lucide-react';
import Navigation from '@/components/Navigation';
import ProductCard from '@/components/ProductCard';
import SearchBar from '@/components/SearchBar';
import CartItem from '@/components/CartItem';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { schlosserApi } from '@/services/schlosserApi';
import { useToast } from '@/components/ui/use-toast';

const VendedorDashboard = () => {
  const { user, userKey } = useAuth();
  const { toast } = useToast();
  
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [sortKey, setSortKey] = useState('stock_desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [clientName, setClientName] = useState('');
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('catalog');

  const loadOrderHistory = useCallback(() => {
    const saved = localStorage.getItem('schlosser_vendor_orders');
    if (saved) setOrders(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      const data = await schlosserApi.fetchProducts('vendor', userKey);
      setProducts(data);
      // padrão: maior estoque primeiro
      setFilteredProducts(sortProducts(data, 'stock_desc'));
      setLoading(false);
    };

    loadProducts();
    loadOrderHistory();
  }, [userKey, loadOrderHistory]);

  const sortProducts = useCallback((list, key) => {
    const arr = Array.isArray(list) ? [...list] : [];
    const byText = (v) => String(v || '').toLowerCase();
    switch (key) {
      case 'stock_asc':
        return arr.sort((a, b) => (Number(a.estoque) || 0) - (Number(b.estoque) || 0));
      case 'price_asc':
        return arr.sort((a, b) => (Number(a.precoH) || 0) - (Number(b.precoH) || 0));
      case 'price_desc':
        return arr.sort((a, b) => (Number(b.precoH) || 0) - (Number(a.precoH) || 0));
      case 'desc_asc':
        return arr.sort((a, b) => byText(a.descricaoPrincipal || a.descricao).localeCompare(byText(b.descricaoPrincipal || b.descricao), 'pt-BR'));
      case 'desc_desc':
        return arr.sort((a, b) => byText(b.descricaoPrincipal || b.descricao).localeCompare(byText(a.descricaoPrincipal || a.descricao), 'pt-BR'));
      case 'stock_desc':
      default:
        return arr.sort((a, b) => (Number(b.estoque) || 0) - (Number(a.estoque) || 0));
    }
  }, []);

  // Memoized to prevent SearchBar loop
  const handleSearch = useCallback((term) => {
    const t = (term || '').toLowerCase().trim();
    setSearchTerm(t);
    if (!t) {
      setFilteredProducts(sortProducts(products, sortKey));
      return;
    }
    const filtered = (products || []).filter(p => 
      (p.sku && String(p.sku).toLowerCase().includes(t)) ||
      ((p.descricaoPrincipal || p.descricao || '').toLowerCase().includes(t))
    );
    setFilteredProducts(sortProducts(filtered, sortKey));
  }, [products, sortKey, sortProducts]);

  const handleSortChange = (e) => {
    const next = e.target.value;
    setSortKey(next);
    const base = Array.isArray(products) ? products : [];
    const filtered = !searchTerm ? base : base.filter(p =>
      (p.sku && String(p.sku).toLowerCase().includes(searchTerm)) ||
      ((p.descricaoPrincipal || p.descricao || '').toLowerCase().includes(searchTerm))
    );
    setFilteredProducts(sortProducts(filtered, next));
  };

  const handleAddToCart = (product, quantity) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.sku === product.sku);
      if (existing) {
        return prev.map(item => 
          item.product.sku === product.sku 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    toast({ title: "Adicionado ao pedido", description: `${quantity}x ${product.sku}` });
  };

  const updateCartQuantity = (sku, newQty) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(item => item.product.sku !== sku));
      return;
    }
    setCart(prev => prev.map(item => item.product.sku === sku ? { ...item, quantity: newQty } : item));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const price = schlosserApi.calculatePrice(item.product, 'vendor');
      return sum + (price * item.quantity);
    }, 0);
  };

  const handleCreateOrder = () => {
    if (cart.length === 0 || !clientName.trim()) {
      toast({ title: "Erro", description: "Carrinho vazio ou nome do cliente não informado.", variant: "destructive" });
      return;
    }

    const newOrder = {
      id: Date.now().toString(),
      clientName: clientName,
      date: new Date().toISOString(),
      items: cart,
      total: calculateTotal(),
      status: 'Pendente'
    };

    const updatedOrders = [newOrder, ...orders];
    setOrders(updatedOrders);
    localStorage.setItem('schlosser_vendor_orders', JSON.stringify(updatedOrders));
    setCart([]);
    setClientName('');
    setActiveTab('history');
    
    toast({ title: "Pedido Criado!", description: `Pedido para ${newOrder.clientName} salvo.` });
  };

  return (
    <>
      <Helmet> <title>Portal do Vendedor</title> </Helmet>

      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Portal do Vendedor</h1>
              <p className="text-sm text-gray-500">Chave: {userKey ? '••••' + userKey.slice(-2) : 'N/A'}</p>
            </div>
            
            <div className="flex bg-white p-1 rounded-lg shadow-sm border border-gray-100">
              <button onClick={() => setActiveTab('catalog')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'catalog' ? 'bg-[#FF8C42] text-white' : 'text-gray-500 hover:text-gray-900'}`}>Produtos</button>
              <button onClick={() => setActiveTab('cart')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'cart' ? 'bg-[#FF8C42] text-white' : 'text-gray-500 hover:text-gray-900'}`}>Pedido Atual ({cart.length})</button>
              <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'history' ? 'bg-[#FF8C42] text-white' : 'text-gray-500 hover:text-gray-900'}`}>Histórico</button>
            </div>
          </div>

          {activeTab === 'catalog' && (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <SearchBar onSearch={handleSearch} />
                  </div>
                  <select
                    value={sortKey}
                    onChange={handleSortChange}
                    className="h-10 border border-gray-200 rounded-lg bg-white shadow-sm px-3 text-sm text-gray-700"
                    title="Ordenar catálogo"
                  >
                    <option value="stock_desc">Estoque (maior → menor)</option>
                    <option value="stock_asc">Estoque (menor → maior)</option>
                    <option value="price_asc">Preço (menor → maior)</option>
                    <option value="price_desc">Preço (maior → menor)</option>
                    <option value="desc_asc">Descrição (A → Z)</option>
                    <option value="desc_desc">Descrição (Z → A)</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-[#FF8C42]" /></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map(product => (
                    <ProductCard key={product.sku} product={product} role="vendor" onAddToCart={handleAddToCart} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'cart' && (
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 p-6">
              <h2 className="text-xl font-bold mb-6">Novo Pedido</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text" 
                    value={clientName} 
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nome do cliente..." 
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:border-[#FF8C42] outline-none"
                  />
                </div>
              </div>

              {cart.length > 0 ? (
                <div className="space-y-2 mb-6">
                  {cart.map(item => (
                    <CartItem key={item.product.sku} item={item} role="vendor" onUpdateQuantity={updateCartQuantity} onRemove={(sku) => updateCartQuantity(sku, 0)} />
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-10">Carrinho vazio.</p>
              )}

              <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                 <span className="font-bold text-gray-700">Total:</span>
                 <span className="font-bold text-xl text-[#FF8C42]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}</span>
              </div>
              
              <Button onClick={handleCreateOrder} className="w-full mt-4 bg-[#FF8C42] hover:bg-[#E67E22] text-white py-6">
                <Save className="w-5 h-5 mr-2" /> Salvar Pedido
              </Button>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              {orders.map(order => (
                <div key={order.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="font-bold text-gray-800">{order.clientName}</span>
                      </div>
                      <p className="text-xs text-gray-500">#{order.id} • {new Date(order.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-[#FF8C42]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}</p>
                       <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{order.status}</span>
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && <p className="text-center text-gray-500 py-10">Nenhum pedido registrado.</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default VendedorDashboard;