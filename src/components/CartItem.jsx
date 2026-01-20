import React from 'react';
import { Trash2, Plus, Minus } from 'lucide-react';
import { schlosserApi } from '@/services/schlosserApi';

const CartItem = ({ item, role, onUpdateQuantity, onRemove }) => {
  const calculation = schlosserApi.calculateLineItem(item.product, item.quantity);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4">
      {/* Image */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-200">
         {item.product.imagem ? (
          <img src={item.product.imagem} alt="" className="w-full h-full object-contain p-1" />
         ) : (
           <span className="text-xs text-gray-400">Img</span>
         )}
      </div>

      {/* Info */}
      <div className="flex-grow min-w-0 w-full">
        <div className="flex justify-between items-start">
            <div className="pr-4">
                <p className="text-[10px] sm:text-xs text-gray-500 font-mono mb-0.5">{item.product.sku}</p>
                <h4 className="font-medium text-gray-800 text-sm sm:text-base line-clamp-2 leading-snug">{item.product.descricao}</h4>
            </div>
            
            {/* Mobile Remove Button (Top Right) */}
            <button 
                onClick={() => onRemove(item.product.sku)}
                className="text-gray-400 hover:text-red-500 p-1 -mt-1 -mr-1 sm:hidden"
            >
                <Trash2 className="w-5 h-5" />
            </button>
        </div>
        
        <div className="mt-2 text-xs sm:text-sm text-gray-600 font-medium bg-gray-50 px-2 py-1 rounded inline-block border border-gray-100">
            {calculation.displayString}
        </div>
      </div>

      {/* Quantity Controls - Full width on mobile, inline on desktop */}
      <div className="flex items-center justify-between w-full sm:w-auto gap-3 mt-2 sm:mt-0">
         <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 h-10 sm:h-auto w-full sm:w-auto">
            <button 
              onClick={() => onUpdateQuantity(item.product.sku, item.quantity - 1)}
              className="p-3 sm:p-1.5 hover:bg-white rounded-l-lg transition-colors text-gray-600 flex-1 flex justify-center"
            >
              <Minus className="w-4 h-4 sm:w-3 sm:h-3" />
            </button>
            <span className="w-10 sm:w-8 text-center font-bold text-sm text-gray-800">{item.quantity}</span>
            <button 
              onClick={() => onUpdateQuantity(item.product.sku, item.quantity + 1)}
              className="p-3 sm:p-1.5 hover:bg-white rounded-r-lg transition-colors text-gray-600 flex-1 flex justify-center"
            >
              <Plus className="w-4 h-4 sm:w-3 sm:h-3" />
            </button>
         </div>
         
         {/* Desktop Remove Button */}
         <button 
           onClick={() => onRemove(item.product.sku)}
           className="hidden sm:block text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"
         >
           <Trash2 className="w-4 h-4" />
         </button>
      </div>
    </div>
  );
};

export default CartItem;