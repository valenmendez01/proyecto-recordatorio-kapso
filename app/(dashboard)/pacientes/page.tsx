import { Button } from '@heroui/button';
import tablaClientes from '../../../components/clientes/tablaClientes';
import { LogOut } from 'lucide-react';
"use client";

// ==================== FUNCIón CERRAR SESIÓN ====================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/"); // Redirige al home
  };

export default function PatientsPage() {
  return (
    <div className="flex justify-center">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-balance mb-3 bg-linear-to-r from-blue-500 to-blue-300 bg-clip-text text-transparent">
              Panel de Administración
            </h1>
            <p className="text-gray-600 text-lg">
              Gestiona servicios, horarios y disponibilidad
            </p>
          </div>
          <Button
            className="gap-2"
            color="danger"
            variant="flat"
            onPress={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Salir
          </Button>
        </div>
      </div>

      <tablaClientes />
    </div>
  );
}