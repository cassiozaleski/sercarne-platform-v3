
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CalendarCheck, Info, XCircle } from 'lucide-react';
import CartItem from '@/components/CartItem';
import DeliveryDateSelector from '@/components/DeliveryDateSelector';
import { schlosserApi } from '@/services/schlosserApi';
import { formatters } from '@/utils/formatters';

const CartStockValidator = ({ cart, routeName, onUpdateQuantity, onRemove, onDateSelect, selectedDate }) => {
  const [stockStatus, setStockStatus] = useState({});
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const validateCart = async () => {
       if (!selectedDate || cart.length === 0) {
           setIsValid(false);
           return;
       }
       
       setLoading(true);
       console.log(`[CartValidator] Validating stock for date: ${selectedDate.toLocaleDateString()}`);
       
       const statuses = {};
       let allValid = true;

       for (const item of cart) {
           const dates = [selectedDate]; 
           const data = await schlosserApi.calculateStockForDates(item.product.sku, item.product.estoque, dates);
           const dayInfo = data[0];
           
           // Round stock here
           const available = formatters.roundStock(dayInfo.available);
           const needed = item.quantity;
           const hasStock = available >= needed;
           
           statuses[item.product.sku] = {
               hasStock,
               available: available,
               needed,
               date: selectedDate
           };

           if (!hasStock) allValid = false;
       }

       setStockStatus(statuses);
       setIsValid(allValid);
       setLoading(false);
    };

    validateCart();
  }, [cart, selectedDate]);

  return (
    <div className="flex flex-col gap-6">
       {/* Top Section: Date Selection Timeline (Horizontal on desktop) */}
       <div className="w-full order-1">
           {routeName && (
               <div className="sticky top-0 z-20 shadow-sm md:shadow-none bg-white md:bg-transparent -mx-4 px-4 md:mx-0 md:px-0 pt-2 md:pt-0">
                   <DeliveryDateSelector 
                       routeName={routeName} 
                       selectedDate={selectedDate}
                       onDateSelect={onDateSelect}
                       stockCheckCart={cart}
                   />
               </div>
           )}
       </div>

       {/* Bottom Section: Items List */}
       <div className="w-full order-2 space-y-4">
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                   <h3 className="font-bold text-gray-800">Itens do Pedido</h3>
                   <span className="text-xs text-gray-500 font-medium">{cart.length} itens</span>
               </div>
               <div className="divide-y divide-gray-100">
                   {cart.map(item => {
                       const status = stockStatus[item.product.sku];
                       return (
                           <div key={item.product.sku} className="p-4 relative hover:bg-gray-50/30 transition-colors">
                               <CartItem 
                                   item={item} 
                                   role="public" 
                                   onUpdateQuantity={onUpdateQuantity} 
                                   onRemove={onRemove} 
                               />
                               
                               {/* Validation Message Inline */}
                               {selectedDate && status && !status.hasStock && (
                                   <div className="mt-3 bg-red-50 text-red-700 text-sm p-3 rounded-lg flex items-start gap-3 border border-red-100 animate-pulse">
                                       <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                       <div className="flex-1">
                                           <p className="font-bold text-sm">Estoque insuficiente para {selectedDate.toLocaleDateString('pt-BR')}</p>
                                           <p className="text-xs mt-1 opacity-90">
                                               Você solicitou <strong>{status.needed}</strong>, mas só temos <strong>{status.available}</strong> disponíveis para esta data.
                                           </p>
                                       </div>
                                   </div>
                               )}
                           </div>
                       );
                   })}
               </div>
           </div>

           {/* Final Status */}
           {selectedDate && (
               <div className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${isValid ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                   {isValid ? (
                       <>
                           <div className="p-2 bg-green-100 rounded-full shrink-0">
                               <CalendarCheck className="w-6 h-6 text-green-600" />
                           </div>
                           <div>
                               <p className="font-bold text-green-800 text-sm md:text-base">Estoque Garantido</p>
                               <p className="text-xs text-green-700">Todos os itens disponíveis para entrega em {selectedDate.toLocaleDateString('pt-BR')}</p>
                           </div>
                       </>
                   ) : (
                       <>
                           <div className="p-2 bg-orange-100 rounded-full shrink-0">
                               <AlertTriangle className="w-6 h-6 text-orange-600" />
                           </div>
                           <div>
                               <p className="font-bold text-orange-800 text-sm md:text-base">Atenção Necessária</p>
                               <p className="text-xs text-orange-700">Selecione outra data ou ajuste as quantidades acima.</p>
                           </div>
                       </>
                   )}
               </div>
           )}
       </div>
    </div>
  );
};

export default CartStockValidator;
