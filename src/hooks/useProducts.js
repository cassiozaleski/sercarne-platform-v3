import { useState, useEffect, useCallback, useRef } from 'react';
import { schlosserApi } from '@/services/schlosserApi';
import { useAuth } from '@/context/AuthContext';

export const useProducts = () => {
  const { role, userKey } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Use a ref to prevent race conditions
  const fetchedRef = useRef(false);

  const fetchProducts = useCallback(async (forceReload = false) => {
    // Determine effective role
    const currentRole = role || 'public';
    const effectiveKey = userKey || '';

    setLoading(true);
    setError(null);

    try {
      console.log(`[useProducts] Fetching for role: ${currentRole}`);
      const data = await schlosserApi.getProducts(currentRole, effectiveKey);
      
      if (Array.isArray(data)) {
        // De-duplication Logic based on SKU
        const uniqueItemsMap = new Map();
        data.forEach(item => {
          if (item && item.sku && !uniqueItemsMap.has(item.sku)) {
            uniqueItemsMap.set(item.sku, item);
          }
        });
        const uniqueItems = Array.from(uniqueItemsMap.values());
        
        console.log(`[useProducts] Loaded ${uniqueItems.length} unique products.`);
        setProducts(uniqueItems);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error('[useProducts] Error:', err);
      setError(err.message || 'Erro ao carregar produtos');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [role, userKey]);

  useEffect(() => {
    fetchedRef.current = false;
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    isMock: false, // Always false now
    refreshProducts: () => fetchProducts(true),
  };
};