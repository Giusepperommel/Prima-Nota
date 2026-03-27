"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalBrandingForm } from "@/components/configurazione/portal-branding-form";
import { PermissionMatrix } from "@/components/configurazione/permission-matrix";

interface ClienteOption {
  id: number;
  nome: string;
  email: string;
}

interface PortaleConfigContentProps {
  clienti: ClienteOption[];
}

export function PortaleConfigContent({ clienti }: PortaleConfigContentProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gestisci le impostazioni del portale clienti: branding, opzioni di visibilita e permessi per ogni cliente.
      </p>
      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">Profilo e Opzioni</TabsTrigger>
          <TabsTrigger value="permessi">Permessi Clienti</TabsTrigger>
        </TabsList>
        <TabsContent value="branding" className="mt-4">
          <PortalBrandingForm />
        </TabsContent>
        <TabsContent value="permessi" className="mt-4">
          <PermissionMatrix clienti={clienti} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
