"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Plus,
  Settings,
  Users,
  Tags,
  ScrollText,
  BarChart3,
  Building2,
  LogOut,
  Landmark,
  RepeatIcon,
  Percent,
  BookOpen,
  ListTree,
  Scissors,
  CalendarCheck,
  ChevronDown,
  BookText,
  ClipboardCheck,
  ShieldCheck,
  Receipt,
  Scale,
  FileCheck2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CompanySwitcher } from "@/components/layout/company-switcher";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Operazioni", href: "/operazioni", icon: FileText },
  { title: "Nuova Operazione", href: "/operazioni/nuova", icon: Plus },
  { title: "Cespiti", href: "/operazioni/cespiti", icon: Landmark },
  { title: "Report", href: "/report", icon: BarChart3 },
];

const bilancioNavItems: NavItem[] = [
  { title: "Bilancio", href: "/bilancio", icon: BarChart3 },
  { title: "Libro Giornale", href: "/bilancio/libro-giornale", icon: ScrollText },
  { title: "Libro Mastro", href: "/bilancio/libro-mastro", icon: BookText },
  { title: "Bilancio di Verifica", href: "/bilancio/bilancio-verifica", icon: ClipboardCheck },
  { title: "Anagrafiche", href: "/bilancio/anagrafiche", icon: Users },
  { title: "Piano dei Conti", href: "/bilancio/piano-dei-conti", icon: ListTree },
  { title: "Registri IVA", href: "/bilancio/registri-iva", icon: FileText },
  { title: "Liquidazioni IVA", href: "/bilancio/liquidazioni-iva", icon: Percent },
  { title: "Ritenute", href: "/bilancio/ritenute", icon: Scissors },
  { title: "Bilancio Civilistico", href: "/bilancio/bilancio-civilistico", icon: Scale },
  { title: "Chiusura Esercizio", href: "/bilancio/chiusura-esercizio", icon: CalendarCheck },
  { title: "Dichiarazioni Fiscali", href: "/dichiarazioni", icon: FileCheck2 },
  { title: "Fatture Elettroniche", href: "/fatture-elettroniche", icon: Receipt },
];

const adminNavItems: NavItem[] = [
  { title: "Societa", href: "/configurazione/societa", icon: Building2 },
  { title: "Soci", href: "/configurazione/soci", icon: Users },
  { title: "Categorie Spesa", href: "/configurazione/categorie", icon: Tags },
  { title: "Ricorrenze", href: "/configurazione/ricorrenze", icon: RepeatIcon },
  { title: "Ripartizioni", href: "/configurazione/ripartizioni", icon: Percent },
  { title: "Log Attivita", href: "/configurazione/log", icon: ScrollText },
  { title: "Accessi", href: "/configurazione/accessi", icon: ShieldCheck },
  { title: "Fatturazione", href: "/configurazione/fatturazione", icon: Receipt },
];

export function AppSidebar({ ruolo, nome, cognome }: { ruolo: string; nome: string; cognome: string }) {
  const pathname = usePathname();
  const { data: session, update } = useSession();
  const isAdmin = ruolo === "ADMIN";
  const modalitaAvanzata = (session?.user as any)?.modalitaAvanzata ?? false;

  const handleToggleAvanzata = async (checked: boolean) => {
    await fetch("/api/utente/preferenze", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modalitaAvanzata: checked }),
    });
    await update({ modalitaAvanzata: checked });
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            PN
          </div>
          <span className="font-semibold text-lg">Prima<span className="text-primary">Nota</span></span>
        </Link>
        <CompanySwitcher />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      item.href !== "/operazioni/nuova" &&
                      pathname.startsWith(item.href) &&
                      // Don't highlight "Operazioni" when on /operazioni/cespiti
                      !(item.href === "/operazioni" && pathname.startsWith("/operazioni/cespiti")))
                  }>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {modalitaAvanzata && (
          <SidebarGroup>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Bilancio
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {bilancioNavItems.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={pathname === item.href}>
                          <Link href={item.href}>
                            <item.icon className="mr-2 h-4 w-4" />
                            {item.title}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Configurazione</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs text-muted-foreground">Avanzata</span>
          <Switch
            checked={modalitaAvanzata}
            onCheckedChange={handleToggleAvanzata}
            className="scale-75"
          />
        </div>
        {modalitaAvanzata && (
          <div className="px-2 pb-1">
            <span className="text-xs text-green-500 font-medium">● AVANZATA</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{nome} {cognome}</span>
            <span className="text-xs text-muted-foreground capitalize">{ruolo.toLowerCase()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Impostazioni"
            >
              <Link href="/impostazioni/account">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Esci"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
