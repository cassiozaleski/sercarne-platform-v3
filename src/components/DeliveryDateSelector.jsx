
import React, { useState, useEffect } from 'react';
import { Calendar, Truck, AlertCircle, Loader2, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { schlosserApi } from '@/services/schlosserApi';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { formatters } from '@/utils/formatters';

const DeliveryDateSelector = ({ routeName, onDateSelect, selectedDate, stockCheckCart = [], city = null }) => {
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const { clientData } = useAuth(); 

  useEffect(() => {
    const loadDates = async () => {
        setLoading(true);
        // Use prop 'city' (public) or clientData.municipio (auth)
        const municipality = city || clientData?.municipio || null;
        console.log(`[DeliverySelector] Loading dates. Route: ${routeName}, Municipality: ${municipality}`);
        
        try {
            const dates = await schlosserApi.getNextDeliveryDates(routeName, 5, municipality);
            
            let datesWithStockInfo = [];
            
            if (stockCheckCart.length > 0) {
                const promises = dates.map(async (date) => {
                    let isAvailable = true;
                    let limitingItem = null;
                    let minStock = Infinity;
                    let limitingNeeded = 0;

                    for (const item of stockCheckCart) {
                        const stockData = await schlosserApi.calculateStockForDates(item.product.sku, item.product.estoque, [date]);
                        // Rounding the stock data here
                        const available = formatters.roundStock(stockData[0].available);
                        
                        if (available < item.quantity) {
                            isAvailable = false;
                            limitingItem = item.product.descricao;
                            minStock = available; 
                            limitingNeeded = item.quantity;
                            break; 
                        }
                    }
                    return { date, isAvailable, limitingItem, minStock, limitingNeeded };
                });
                
                datesWithStockInfo = await Promise.all(promises);
            } else {
                datesWithStockInfo = dates.map(d => ({ date: d, isAvailable: true, limitingItem: null }));
            }

            setAvailableDates(datesWithStockInfo);

            if (datesWithStockInfo.length > 0) {
                 const currentIsValid = selectedDate && datesWithStockInfo.find(d => d.date.toDateString() === selectedDate.toDateString())?.isAvailable;
                 if (!currentIsValid && !selectedDate) {
                     const firstValid = datesWithStockInfo.find(d => d.isAvailable);
                     if (firstValid) onDateSelect(firstValid.date);
                 }
            }

        } catch (error) {
            console.error("Failed to calculate dates", error);
        } finally {
            setLoading(false);
        }
    };
    
    if (routeName || city || clientData) {
        loadDates();
    }
  }, [routeName, stockCheckCart, clientData, city]);

  const isSelected = (d) => selectedDate && d.toDateString() === selectedDate.toDateString();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full">
        <div className="bg-gray-50/80 p-3 md:p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FF8C42]" />
                <span className="hidden md:inline">Selecione a Data de Entrega</span>
                <span className="md:hidden">Data de Entrega</span>
            </h3>
            <span className="text-[10px] md:text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200 truncate max-w-[120px]">
                {city || (clientData?.municipio ? clientData.municipio : (routeName ? routeName.split(' - ')[0] : 'Padrão'))}
            </span>
        </div>
        
        <div className="p-3 md:p-4">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-400 mb-2" />
                    <span className="text-xs text-gray-400">Verificando disponibilidade...</span>
                </div>
            ) : (
                <div className="flex flex-col md:flex-row gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
                    {availableDates.length > 0 ? availableDates.map(({ date, isAvailable, limitingItem, minStock, limitingNeeded }, idx) => (
                        <button
                            key={idx}
                            onClick={() => isAvailable && onDateSelect(date)}
                            disabled={!isAvailable}
                            className={cn(
                                "relative flex-shrink-0 w-full md:w-[180px] p-3 rounded-lg border-2 text-left transition-all flex md:flex-col items-center md:items-start justify-between md:justify-start gap-3 md:gap-2 group",
                                isSelected(date) 
                                    ? "bg-orange-50 border-[#FF8C42] shadow-md scale-[1.02]" 
                                    : "bg-white border-gray-100 hover:border-orange-200 hover:bg-orange-50/30",
                                !isAvailable && "opacity-60 bg-gray-50 border-gray-100 cursor-not-allowed grayscale-[0.5]"
                            )}
                        >
                            <div className={cn(
                                "flex flex-col items-center justify-center w-12 h-12 md:w-full md:h-16 md:flex-row md:gap-3 rounded-lg border",
                                isSelected(date) ? "bg-white border-orange-200 md:bg-white/50" : "bg-gray-50 border-gray-200"
                            )}>
                                <span className="text-[10px] uppercase font-bold text-gray-500 md:text-xs">
                                    {new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '')}
                                </span>
                                <span className="text-lg md:text-2xl font-bold text-gray-800">
                                    {date.getDate()}
                                </span>
                                <span className="hidden md:inline text-xs text-gray-400 font-medium">
                                    {new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '')}
                                </span>
                            </div>
                            
                            <div className="flex-1 w-full">
                                <p className="md:hidden font-medium text-sm text-gray-900">
                                    {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date)}
                                </p>
                                
                                {!isAvailable ? (
                                    <div className="flex items-center gap-1.5 text-xs text-red-600 font-bold mt-1 bg-red-50 p-1 rounded">
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>Falta: {limitingItem ? limitingItem.split(' ')[0] : ''}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold mt-1 bg-green-50 p-1 rounded">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Disponível</span>
                                    </div>
                                )}
                            </div>

                            {isSelected(date) && <div className="absolute right-3 top-3 w-3 h-3 bg-[#FF8C42] rounded-full shadow-sm ring-2 ring-white" />}
                            
                            {isAvailable && idx === 0 && !isSelected(date) && (
                                <span className="absolute -top-2 -right-2 md:top-2 md:right-2 bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
                                    Recomendado
                                </span>
                            )}
                        </button>
                    )) : (
                        <div className="w-full text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <Truck className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">Nenhuma data disponível para esta rota.</p>
                        </div>
                    )}
                </div>
            )}
            
            <div className="mt-3 flex items-start gap-2 text-[10px] md:text-xs text-gray-500 bg-blue-50/50 p-2 md:p-3 rounded-lg border border-blue-100">
                <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                    Pedidos feitos após <strong>17:30</strong> são agendados para a próxima rota disponível.
                </p>
            </div>
        </div>
    </div>
  );
};

export default DeliveryDateSelector;
