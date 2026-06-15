"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  Coins,
  Globe,
  Home,
  LayoutGrid,
  Library,
  Lightbulb,
  LogOut,
  Sparkles,
  Star,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", activePath: "/", label: "Dashboard", icon: Home },
  { href: "/brands", activePath: "/brands", label: "Brand Brain", icon: Sparkles },
  { href: "/ideas", activePath: "/ideas", label: "Ideias de pauta", icon: Lightbulb },
  { href: "/generate", activePath: "/generate", label: "Gerar conteúdo", icon: Wand2 },
  { href: "/generate?ext=1", activePath: "none", label: "Recriar post", icon: Globe },
  { href: "/references", activePath: "/references", label: "Benchmark", icon: Star },
  { href: "/trends", activePath: "/trends", label: "Tendências", icon: TrendingUp },
  { href: "/calendar", activePath: "/calendar", label: "Calendário", icon: Calendar },
  { href: "/templates", activePath: "/templates", label: "Templates", icon: LayoutGrid },
  { href: "/library", activePath: "/library", label: "Biblioteca", icon: Library },
  { href: "/analytics", activePath: "/analytics", label: "Métricas", icon: BarChart3 },
  { href: "/usage", activePath: "/usage", label: "Créditos & Uso", icon: Coins },
];

interface SidebarProps {
  workspaceName: string;
  userName: string;
  plan: string;
  logoutAction: () => Promise<void>;
}

function LumioIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="11,20 2,8 5.5,6.5" fill="#3B6BF0" />
      <polygon points="11,20 5.5,6.5 8.5,5" fill="#7B52E0" />
      <polygon points="11,20 8.5,5 13.5,5" fill="#C03870" />
      <polygon points="11,20 13.5,5 16.5,6.5" fill="#E05428" />
      <polygon points="11,20 16.5,6.5 20,8" fill="#F0A010" />
      <circle cx="11" cy="3" r="1.8" fill="none" stroke="#F0A010" strokeWidth="1.3" />
    </svg>
  );
}

export function Sidebar({ workspaceName, userName, plan, logoutAction }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand mark */}
      <div className="border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <LumioIcon />
          <div className="min-w-0">
            <p
              className="text-sm font-semibold tracking-tight text-white"
              style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
            >
              Lumio
            </p>
            <p className="truncate text-[10px] text-sidebar-foreground/40">
              {workspaceName}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const active =
            item.activePath === "none"
              ? false
              : item.activePath === "/"
              ? pathname === "/"
              : pathname.startsWith(item.activePath);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all",
                active
                  ? "bg-primary/15 font-medium text-primary"
                  : "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-opacity",
                  active ? "opacity-100" : "opacity-50 group-hover:opacity-100"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-foreground/90">{userName}</p>
            <p className="text-[10px] capitalize text-sidebar-foreground/40">Plano {plan}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sair"
              className="rounded p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
