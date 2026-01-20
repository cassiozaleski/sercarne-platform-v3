
import React, { useState, useEffect } from 'react';
import { Search, MapPin, Map } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { schlosserApi } from '@/services/schlosserApi';

const CitySelector = ({ isOpen, onSelect }) => {
  const [cities, setCities] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadCities();
    }
  }, [isOpen]);

  const loadCities = async () => {
    setLoading(true);
    const data = await schlosserApi.getCities();
    setCities(data);
    setFiltered(data);
    setLoading(false);
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (!val) {
      setFiltered(cities);
      return;
    }
    const lower = val.toLowerCase();
    const results = cities.filter(c => c.name.toLowerCase().includes(lower));
    setFiltered(results);
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Selecione sua Cidade</DialogTitle>
          <DialogDescription>
            Para mostrarmos a disponibilidade correta de entrega.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar cidade..."
              className="pl-9"
              value={search}
              onChange={handleSearch}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="text-center py-4 text-gray-500">Carregando cidades...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-4 text-gray-500">Nenhuma cidade encontrada.</div>
            ) : (
              filtered.map((city, idx) => (
                <div 
                  key={idx}
                  onClick={() => onSelect(city)}
                  className="p-3 border rounded-lg hover:bg-orange-50 hover:border-orange-200 cursor-pointer transition-all group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                     <div className="bg-gray-100 p-2 rounded-full group-hover:bg-white transition-colors">
                        <MapPin className="w-4 h-4 text-gray-500 group-hover:text-orange-500" />
                     </div>
                     <span className="font-medium text-gray-700 group-hover:text-orange-800">{city.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 border px-1.5 py-0.5 rounded bg-gray-50">
                      {city.routeId?.split(' - ')[0]}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CitySelector;
