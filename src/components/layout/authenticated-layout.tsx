"use client";

import { SessionProvider } from "next-auth/react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Separator } from "@/components/ui/separator";
import { AlertBell } from "@/components/intelligence/alert-bell";

type Props = {
  children: React.ReactNode;
  user: {
    nome: string;
    cognome: string;
    ruolo: string;
  };
  pageTitle?: string;
};

export function AuthenticatedLayout({ children, user, pageTitle }: Props) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <AppSidebar ruolo={user.ruolo} nome={user.nome} cognome={user.cognome} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            {pageTitle && <h1 className="text-sm font-medium">{pageTitle}</h1>}
            <div className="ml-auto">
              <AlertBell />
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-6 overflow-x-hidden">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
