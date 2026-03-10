"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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

const adminNavItems: NavItem[] = [
  { title: "Societa", href: "/configurazione/societa", icon: Building2 },
  { title: "Soci", href: "/configurazione/soci", icon: Users },
  { title: "Categorie Spesa", href: "/configurazione/categorie", icon: Tags },
  { title: "Ricorrenze", href: "/configurazione/ricorrenze", icon: RepeatIcon },
  { title: "Log Attivita", href: "/configurazione/log", icon: ScrollText },
];

export function AppSidebar({ ruolo, nome, cognome }: { ruolo: string; nome: string; cognome: string }) {
  const pathname = usePathname();
  const isAdmin = ruolo === "ADMIN";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            PN
          </div>
          <span className="font-semibold text-lg">Prima<span className="text-primary">Nota</span></span>
        </Link>
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
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{nome} {cognome}</span>
            <span className="text-xs text-muted-foreground capitalize">{ruolo.toLowerCase()}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Esci"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
