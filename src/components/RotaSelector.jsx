
import React, { useState, useEffect, useMemo } from 'react';
import { useRotas } from '@/hooks/useRotas';
import { Calendar, Clock, Truck } from 'lucide-react';

const RotaSelector = ({ onRouteSelect, selectedRouteId }) => {
  const { rotas, loading, validateRoute } = useRotas();
  const [validationMsg, setValidationMsg] = useState('');

  // Memoize deliveryDate so it doesn't change on every render
  const deliveryDate = useMemo(() => new Date(), []);

  useEffect(() => {
    if (selectedRouteId && rotas.length > 0) {
      const result = validateRoute(selectedRouteId, deliveryDate);
      if (!result.valid) {
        setValidationMsg(result.reason);
      } else {
        setValidationMsg('');
      }
    }
  }, [selectedRouteId, rotas, validateRoute, deliveryDate]);

  if (loading) return <div className="text-xs text-gray-400">Carregando rotas...</div>;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Selecione a Rota de Entrega</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rotas.map(rota => {
           const isSelected = selectedRouteId === rota.id;
           const result = validateRoute(rota.id, deliveryDate);
           const isBlocked = !result.valid;

           return (
             <button
               key={rota.id}
               onClick={() => !isBlocked && onRouteSelect(rota)}
               disabled={isBlocked}
               className={`relative p-3 rounded-lg border text-left transition-all ${
                 isSelected 
                   ? 'border-[#FF8C42] bg-orange-50 ring-1 ring-[#FF8C42]' 
                   : isBlocked 
                     ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                     : 'border-gray-200 hover:border-gray-300 bg-white'
               }`}
             >
               <div className="flex justify-between items-start">
                 <div>
                   <p className={`font-medium text-sm ${isSelected ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                     {rota.nome}
                   </p>
                   <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                     <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> Limite: {rota.cutoff}</span>
                   </div>
                 </div>
                 {isSelected && <Truck className="w-4 h-4 text-[#FF8C42]" />}
               </div>
               {isBlocked && (
                 <div className="text-[10px] text-red-500 mt-1 font-medium">
                   {result.reason}
                 </div>
               )}
             </button>
           );
        })}
      </div>
      {validationMsg && (
        <p className="text-xs text-red-500 mt-1">{validationMsg}</p>
      )}
    </div>
  );
};

export default RotaSelector;
