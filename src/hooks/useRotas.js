
import { useState, useEffect, useCallback } from 'react';
import { schlosserApi } from '@/services/schlosserApi';
import { useAuth } from '@/context/AuthContext';

export const useRotas = (city = null) => {
  const { role, userKey } = useAuth();
  const [rotas, setRotas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Force fresh route data on component mount
  useEffect(() => {
    const loadRotas = async () => {
      setLoading(true);
      try {
        let data;
        if (city) {
          // Task 3: Call updated getRoutesByCity() to get all matching routes
          data = await schlosserApi.getRoutesByCity(city);
        } else {
          // Fallback to getting all definitions if no city
          data = await schlosserApi.getRouteDefinitions();
        }
        setRotas(data);
      } catch (err) {
        console.error("Failed to load routes", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadRotas();
  }, [role, userKey, city]);

  const validateRoute = useCallback((routeId, dateObj) => {
    const route = rotas.find(r => r.id === routeId);
    if (!route) return { valid: false, reason: 'Rota não encontrada' };

    const dayOfWeek = dateObj.getDay(); 
    
    // Check if day is allowed
    if (!route.parsedDays.includes(dayOfWeek)) {
       return { valid: false, reason: 'Dia não atendido por esta rota' };
    }

    // Check cutoff if date is today
    const now = new Date();
    const isToday = dateObj.toDateString() === now.toDateString();
    
    if (isToday) {
      const [cutHour, cutMinute] = route.cutoff.split(':').map(Number);
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      if (currentHour > cutHour || (currentHour === cutHour && currentMinute >= cutMinute)) {
        return { valid: false, reason: `Horário limite (${route.cutoff}) excedido para hoje` };
      }
    }

    return { valid: true };
  }, [rotas]);

  return {
    rotas,
    loading,
    validateRoute
  };
};
