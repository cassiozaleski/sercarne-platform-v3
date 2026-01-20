
import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, XCircle, PackagePlus, Calendar } from 'lucide-react';
import { schlosserApi } from '@/services/schlosserApi';
import { formatters } from '@/utils/formatters';

const StockTimeline = ({ product, routeName }) => {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTimeline = async () => {
      if (!product || !routeName) return;
      
      setLoading(true);
      try {
        const dates = await schlosserApi.getNextDeliveryDates(routeName, 5);
        const data = await schlosserApi.calculateStockForDates(product.sku, product.estoque, dates);
        setTimeline(data);
      } catch (err) {
        console.error("Failed to load timeline", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadTimeline();
  }, [product, routeName]);

  if (!product || !routeName) return null;
  if (loading) return <div className="h-16 bg-gray-50 rounded animate-pulse w-full"></div>;

  return (
    <div className="mt-4">
       <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide flex items-center gap-2">
         <Calendar className="w-3 h-3" /> Disponibilidade (Próximas Entregas)
       </h4>
       <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
         {timeline.map((day, idx) => {
           const available = formatters.roundStock(day.available);
           return (
             <div 
               key={idx}
               className={`flex-shrink-0 min-w-[100px] p-2 rounded-lg border text-center transition-all ${
                 day.status === 'ok' ? 'bg-green-50 border-green-200' :
                 day.status === 'low' ? 'bg-yellow-50 border-yellow-200' :
                 'bg-red-50 border-red-200 opacity-75 grayscale'
               }`}
             >
               <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">
                 {day.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
               </p>
               
               <div className="flex items-center justify-center gap-1 mb-1">
                 {day.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                 {day.status === 'low' && <AlertCircle className="w-4 h-4 text-yellow-600" />}
                 {day.status === 'out' && <XCircle className="w-4 h-4 text-red-600" />}
                 <span className={`text-sm font-bold ${
                     day.status === 'ok' ? 'text-green-700' :
                     day.status === 'low' ? 'text-yellow-700' :
                     'text-red-700'
                 }`}>
                   {available}
                 </span>
               </div>
  
               {day.incoming && (
                 <div className="flex items-center justify-center gap-1 mt-1 text-[9px] bg-white/60 rounded px-1 py-0.5 text-blue-600 font-medium">
                   <PackagePlus className="w-3 h-3" /> Entrada
                 </div>
               )}
             </div>
           );
         })}
       </div>
    </div>
  );
};

export default StockTimeline;
