
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Loader2, ImageOff, PackageCheck, AlertTriangle, CalendarDays, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatters } from '@/utils/formatters';

const ProductCard = ({ product, role, onAddToCart, selectedDate, reservedQuantity = 0 }) => {
  const [quantity, setQuantity] = useState(1);
  const imgSrc = product?.imagem || product?.imagemMarca;
  const [imageStatus, setImageStatus] = useState(imgSrc ? 'loading' : 'empty');

  useEffect(() => {
    const src = product?.imagem || product?.imagemMarca;
    if (src) {
        setImageStatus('loading');
    } else {
        setImageStatus('empty');
    }
  }, [product?.imagem, product?.imagemMarca]);

  if (!product) return null;

  const sku = Number(product.sku);
  const unitLabel = sku >= 410000 ? 'CX' : 'UND';
  const price = product.precoH || 0;

  // Base Stock (Column H) - Rounded
  const baseStock = formatters.roundStock(product.estoque || 0);
  
  // Available = Base - Reserved (passed from parent or 0)
  const availableStock = Math.max(0, baseStock - reservedQuantity);
  
  // Status Colors
  let stockColor = 'text-green-600 bg-green-50 border-green-100';
  let statusText = 'Em Estoque';
  
  if (availableStock <= 0) {
      stockColor = 'text-red-600 bg-red-50 border-red-100';
      statusText = 'Esgotado';
  } else if (availableStock <= 5) {
      stockColor = 'text-yellow-600 bg-yellow-50 border-yellow-100';
      statusText = 'Últimas Unidades';
  }

  const handleIncrement = () => setQuantity(q => q + 1);
  const handleDecrement = () => {
    if (quantity > 1) setQuantity(q => q - 1);
  };

  const handleAdd = () => {
    onAddToCart(product, quantity);
    setQuantity(1);
  };

  const formatWeight = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val);

  return (
    <div className="bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col h-full group/card relative">
      
      {/* Reliable Stock Badge */}
      <div className="absolute top-2 left-2 z-30">
         <span className="bg-white/90 backdrop-blur text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-gray-200 flex items-center gap-1 text-gray-600">
            <Archive className="w-3 h-3" /> Cód: {product.sku}
         </span>
      </div>

      <div className="relative w-full bg-gray-50 overflow-hidden flex items-center justify-center p-2 md:p-4 min-h-[160px] md:min-h-[180px]">
        {imageStatus === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42] opacity-50" />
          </div>
        )}
        {imgSrc && imageStatus !== 'error' ? (
          <img 
            src={imgSrc} 
            alt={product.descricao} 
            className={`w-full h-auto max-h-[140px] md:max-h-[220px] object-contain transition-all duration-500 group-hover/card:scale-105 ${imageStatus === 'loading' ? 'opacity-0' : 'opacity-100'}`}
            loading="lazy"
            onLoad={() => setImageStatus('loaded')}
            onError={() => setImageStatus('error')}
          />
        ) : null}
        {(imageStatus === 'error' || imageStatus === 'empty') && (
          <div className="flex flex-col items-center justify-center text-gray-400 py-8 md:py-12">
            <ImageOff className="w-8 h-8 md:w-10 md:h-10 mb-2 opacity-30" />
            <span className="text-xs font-medium opacity-50">Sem Imagem</span>
          </div>
        )}
        
        {/* Stock Overlay */}
        <div className={`absolute bottom-2 right-2 px-2 py-1 rounded text-[10px] md:text-xs font-bold border shadow-sm z-20 flex items-center gap-1.5 ${stockColor}`}>
             {availableStock > 0 ? (
                 <PackageCheck className="w-3 h-3" />
             ) : (
                 <AlertTriangle className="w-3 h-3" />
             )}
             {statusText}: {availableStock} {unitLabel}
        </div>
      </div>

      <div className="p-3 md:p-4 flex flex-col flex-grow bg-white relative z-20">
        <div className="flex-grow">
          <h3 className="font-semibold text-gray-800 line-clamp-2 mb-1 min-h-[2.5rem] text-sm md:text-base leading-snug" title={product.descricaoPrincipal || product.descricao}>
            {product.descricaoPrincipal || product.descricao || 'Produto sem descrição'}
          </h3>
          {product.descricaoTecnica ? (
            <p className="text-xs text-gray-500 line-clamp-2 mb-2" title={product.descricaoTecnica}>
              {product.descricaoTecnica}
            </p>
          ) : null}
          
          <div className="mb-3">
             <div className="text-xl md:text-2xl font-bold text-[#FF8C42] tracking-tight">
               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)}
               <span className="text-sm font-normal text-gray-500 ml-1">/kg</span>
             </div>
             {sku < 410000 && product.peso > 0 && (
                <p className="text-xs text-gray-400 mt-1">Peso aprox: {formatWeight(product.peso)} kg</p>
             )}
             {sku >= 410000 && (
                <p className="text-xs text-gray-400 mt-1">Caixa Peso Aprox: 10kg</p>
             )}
          </div>

          {/* Incoming Stock Info - Fixed Unit Label with UND - Rounded */}
          {product.proximaEntrada && availableStock <= 5 && (
              <div className="mb-3 bg-blue-50 p-2 rounded border border-blue-100 text-[10px] md:text-xs text-blue-700 flex items-center gap-2">
                 <CalendarDays className="w-3 h-3 shrink-0" />
                 <span>
                    Chega dia {new Date(product.proximaEntrada.date).getDate()}/{new Date(product.proximaEntrada.date).getMonth()+1}: 
                    <span className="font-bold ml-1">+{formatters.roundStock(product.proximaEntrada.qty)} UND</span>
                 </span>
              </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-3 pt-4 border-t border-gray-100 mt-2">
            <div className="flex items-center justify-center bg-gray-50 rounded-lg p-1 border border-gray-200 h-10 md:h-auto">
              <button onClick={handleDecrement} className="p-2 md:p-1.5 hover:bg-white rounded-md transition-colors text-gray-600 flex-1 flex justify-center" disabled={quantity <= 1}>
                  <Minus className="w-4 h-4 md:w-3.5 md:h-3.5" />
              </button>
              <span className="w-12 md:w-8 text-center font-bold text-sm text-gray-800">{quantity}</span>
              <button onClick={handleIncrement} className="p-2 md:p-1.5 hover:bg-white rounded-md transition-colors text-gray-600 flex-1 flex justify-center">
                  <Plus className="w-4 h-4 md:w-3.5 md:h-3.5" />
              </button>
            </div>
            
            <Button 
                onClick={handleAdd}
                disabled={availableStock <= 0}
                className={`flex-1 text-white shadow-sm transition-all text-xs md:text-xs font-bold uppercase tracking-wide h-12 md:h-9 rounded-lg ${availableStock > 0 ? 'bg-[#FF8C42] hover:bg-[#e67a30] hover:shadow-md' : 'bg-gray-300 cursor-not-allowed'}`}
            >
                {availableStock > 0 ? (
                    <>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Adicionar
                    </>
                ) : 'Indisponível'}
            </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
