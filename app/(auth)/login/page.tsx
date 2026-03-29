"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { LockIcon, MailIcon } from "lucide-react"; // Cambiado UserIcon por MailIcon
import { login } from "@/app/actions/auth-actions";
import { title } from "@/components/primitives";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    
    // Llamamos a la acción. Si hay un error, lo capturamos.
    // Si no hay error, la acción misma hará el redirect.
    const result = await login(formData);
    
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md p-4 shadow-xl border-none bg-background/60 dark:bg-default-50/50 backdrop-blur-md">
        <CardHeader className="flex flex-col gap-1 items-center pb-8">
          <h1 className={title({ size: "sm", color: "blue" })}>Bienvenido</h1>
          <p className="text-default-500 text-small">Ingresa tus credenciales para continuar</p>
        </CardHeader>
        
        <CardBody>
          {/* Usamos action directamente con nuestra función asíncrona */}
          <form action={handleSubmit} className="flex flex-col gap-4">
            <Input
              isRequired
              name="email" // CAMBIADO: Antes era "username"
              type="email"
              label="Email"
              placeholder="tu@email.com"
              variant="bordered"
              labelPlacement="outside"
              startContent={
                <MailIcon className="text-2xl text-default-400 pointer-events-none flex-shrink-0" />
              }
            />
            
            <Input
              isRequired
              name="password"
              label="Contraseña"
              placeholder="********"
              type="password"
              variant="bordered"
              labelPlacement="outside"
              startContent={
                <LockIcon className="text-2xl text-default-400 pointer-events-none flex-shrink-0" />
              }
            />

            {error && (
              <div className="bg-danger-50 text-danger text-tiny p-3 rounded-medium border-1 border-danger-200">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              color="primary" 
              className="mt-2 font-semibold"
              isLoading={loading}
              size="lg"
            >
              Ingresar
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}