import React, { useState, useEffect } from 'react';
import { Search, MapPin, Truck, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { schlosserApi } from '@/services/schlosserApi';

const ClientSelector = ({ isOpen, onSelect }) => {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  const loadClients = async () => {
    setLoading(true);
    const data = await schlosserApi.getClients();
    setClients(data);
    setFiltered(data.slice(0, 10)); // Show first 10 initially
    setLoading(false);
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (!val) {
      setFiltered(clients.slice(0, 10));
      return;
    }
    const lower = val.toLowerCase();
    const results = clients.filter(c => 
      (c.nome && c.nome.toLowerCase().includes(lower)) ||
      (c.municipio && c.municipio.toLowerCase().includes(lower))
    );
    setFiltered(results.slice(0, 50));
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Identifique sua Loja</DialogTitle>
          <DialogDescription>
            Selecione seu estabelecimento para ver rotas e disponibilidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou cidade..."
              className="pl-9"
              value={search}
              onChange={handleSearch}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="text-center py-4 text-gray-500">Carregando clientes...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-4 text-gray-500">Nenhum cliente encontrado.</div>
            ) : (
              filtered.map((client, idx) => (
                <div 
                  key={idx}
                  onClick={() => onSelect(client)}
                  className="p-3 border rounded-lg hover:bg-orange-50 hover:border-orange-200 cursor-pointer transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-gray-800 group-hover:text-orange-700">{client.nome}</h4>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {client.rota ? client.rota.split(' - ')[0] : '?'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {client.municipio}</span>
                    <span className="flex items-center"><Truck className="w-3 h-3 mr-1" /> {client.rota ? client.rota.substring(0, 15) + '...' : 'Rota N/A'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientSelector;