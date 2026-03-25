"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CespitiList } from "./cespiti-list";
import { RegistroAmmortizzabili } from "./registro-ammortizzabili";

type Props = {
  ruolo: string;
};

export function CespitiTabs({ ruolo }: Props) {
  return (
    <Tabs defaultValue="elenco" className="space-y-4">
      <TabsList>
        <TabsTrigger value="elenco">Elenco Cespiti</TabsTrigger>
        <TabsTrigger value="registro">Registro Beni Ammortizzabili</TabsTrigger>
      </TabsList>
      <TabsContent value="elenco">
        <CespitiList ruolo={ruolo} />
      </TabsContent>
      <TabsContent value="registro">
        <RegistroAmmortizzabili />
      </TabsContent>
    </Tabs>
  );
}
