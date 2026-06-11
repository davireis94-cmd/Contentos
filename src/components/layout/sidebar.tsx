"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Home,
  Layers,
  LayoutGrid,
  Library,
  LogOut,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/brands", label: "Brand Brain", icon: Sparkles },
  { href: "/generate", label: "Gerar conteúdo", icon: Wand2 },
  { href: "/calendar", label: "Calendário", icon: Calendar },
  { href: "/templates", label: "Templates", icon: LayoutGrid },
  { href: "/library", label: "Biblioteca", icon: Library },
];

interface SidebarProps {
  workspaceName: string;
  userName: string;
  plan: string;
  logoutAction: () => Promise<void>;
}

export function Sidebar({
  workspaceName,
  userName,
  plan,
  logoutAction,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
      <div className="border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{workspaceName}</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-2">
        <div className="flex items-center gap-2 rounded-md px-2.5 py-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-medium text-background">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{userName}</p>
            <p className="text-[11px] capitalize text-muted-foreground">
              Plano {plan}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sair"
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
