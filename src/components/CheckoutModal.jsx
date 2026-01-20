
import React, { useState } from 'react';
import { User, Mail, Phone, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { validators } from '@/utils/validators';

const CheckoutModal = ({ isOpen, onClose, onConfirm, totalValue }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    documento: '', // CPF or CNPJ
    register: false
  });

  const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (checked) => {
      setFormData(prev => ({ ...prev, register: checked }));
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      
      // Basic Validation
      const nameError = validators.nome(formData.nome);
      if (nameError) {
          toast({ title: "Erro no formulário", description: nameError, variant: "destructive" });
          return;
      }
      if (!formData.telefone) {
           toast({ title: "Erro no formulário", description: "Telefone é obrigatório para contato.", variant: "destructive" });
           return;
      }

      setLoading(true);
      try {
          await onConfirm(formData);
          onClose();
      } catch (error) {
          console.error(error);
          toast({ title: "Erro ao enviar", description: "Tente novamente.", variant: "destructive" });
      } finally {
          setLoading(false);
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Finalizar Pedido</DialogTitle>
          <DialogDescription>
            Informe seus dados para contato e entrega.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
           <div className="space-y-2">
               <label htmlFor="nome" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Nome Completo *</label>
               <div className="relative">
                   <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                   <Input id="nome" name="nome" value={formData.nome} onChange={handleChange} className="pl-9" placeholder="Seu nome" />
               </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                   <label htmlFor="telefone" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Telefone / WhatsApp *</label>
                   <div className="relative">
                       <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                       <Input id="telefone" name="telefone" value={formData.telefone} onChange={handleChange} className="pl-9" placeholder="(00) 00000-0000" />
                   </div>
               </div>
               <div className="space-y-2">
                   <label htmlFor="documento" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">CPF / CNPJ</label>
                   <div className="relative">
                       <FileText className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                       <Input id="documento" name="documento" value={formData.documento} onChange={handleChange} className="pl-9" placeholder="Opcional" />
                   </div>
               </div>
           </div>

           <div className="space-y-2">
               <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
               <div className="relative">
                   <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                   <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="pl-9" placeholder="seu@email.com" />
               </div>
           </div>

           <div className="flex items-center space-x-2 pt-2">
               <input 
                 type="checkbox" 
                 id="register" 
                 checked={formData.register} 
                 onChange={(e) => handleRegisterChange(e.target.checked)}
                 className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-600"
               />
               <label htmlFor="register" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                   Quero me cadastrar para próximos pedidos
               </label>
           </div>
           
           <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mt-4">
               <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-600">Total a confirmar:</span>
                   <span className="font-bold text-orange-700 text-lg">
                       {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                   </span>
               </div>
           </div>

           <DialogFooter className="mt-6">
               <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
               <Button type="submit" className="bg-[#FF8C42] hover:bg-[#E67E22] text-white" disabled={loading}>
                   {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                   Confirmar Pedido
               </Button>
           </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
