
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, TrendingUp, Users, DollarSign, List } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/context/AuthContext';
import { schlosserApi } from '@/services/schlosserApi';

const AdminDashboard = () => {
  const { userKey } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allOrders, setAllOrders] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await schlosserApi.fetchProducts('admin', userKey);
      setProducts(data);

      // Consolidate mock orders for demo
      const clientOrders = JSON.parse(localStorage.getItem('schlosser_client_orders') || '[]');
      const vendorOrders = JSON.parse(localStorage.getItem('schlosser_vendor_orders') || '[]');
      setAllOrders([...clientOrders, ...vendorOrders].sort((a,b) => new Date(b.date) - new Date(a.date)));
      
      setLoading(false);
    };
    loadData();
  }, [userKey]);

  const totalRevenue = allOrders.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <>
      <Helmet><title>Painel Admin</title></Helmet>

      <div className="min-h-screen bg-gray-50">
        <Navigation />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Visão Geral Administrativa</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg mr-4"><DollarSign className="w-8 h-8" /></div>
              <div>
                <p className="text-sm text-gray-500">Receita Total Estimada</p>
                <p className="text-2xl font-bold text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4"><List className="w-8 h-8" /></div>
              <div>
                <p className="text-sm text-gray-500">Total de Pedidos</p>
                <p className="text-2xl font-bold text-gray-900">{allOrders.length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-lg mr-4"><TrendingUp className="w-8 h-8" /></div>
              <div>
                <p className="text-sm text-gray-500">Produtos no Catálogo</p>
                <p className="text-2xl font-bold text-gray-900">{products.length}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <h2 className="text-xl font-bold mb-4">Últimos Pedidos</h2>
               <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                 {allOrders.length > 0 ? allOrders.map((order, idx) => (
                   <div key={order.id || idx} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded border border-gray-50">
                     <div>
                       <p className="font-bold text-gray-800">{order.clientName || 'Cliente Web'}</p>
                       <p className="text-xs text-gray-400">{new Date(order.date).toLocaleDateString()}</p>
                     </div>
                     <span className="font-bold text-[#FF8C42]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}</span>
                   </div>
                 )) : <p className="text-gray-400 text-center py-4">Sem dados.</p>}
               </div>
             </div>

             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <h2 className="text-xl font-bold mb-4">Monitoramento de Preços (Amostra)</h2>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                     <tr>
                       <th className="px-4 py-3">SKU</th>
                       <th className="px-4 py-3">Produto</th>
                       <th className="px-4 py-3">Tab Admin (2)</th>
                     </tr>
                   </thead>
                   <tbody>
                     {loading ? (
                       <tr><td colSpan="3" className="text-center py-4">Carregando...</td></tr>
                     ) : products.slice(0, 8).map(p => (
                       <tr key={p.sku} className="border-b">
                         <td className="px-4 py-3 font-mono text-gray-500">{p.sku}</td>
                         <td className="px-4 py-3 truncate max-w-[200px]">{p.descricao}</td>
                         <td className="px-4 py-3 font-bold text-green-600">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(schlosserApi.calculatePrice(p, 'admin'))}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
