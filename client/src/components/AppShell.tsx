import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FileStack,
  Sparkles,
  Library,
  CalendarClock,
  Settings,
  Plug,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useTheme } from "@/lib/themeContext";
import { useWorkspace } from "@/lib/workspaceContext";
import { useBrand } from "@/lib/brandContext";
import { useAuth } from "@/lib/authContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/sources", label: "Sources", icon: FileStack },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/library", label: "Library", icon: Library },
  { href: "/schedules", label: "Schedules", icon: CalendarClock },
  { href: "/settings", label: "Settings", icon: Settings },
];

function BrandMark() {
  const brand = useBrand();
  if (brand.logoUrl) {
    return <img src={brand.logoUrl} alt={brand.name} className="h-6" />;
  }
  return (
    <div
      className="h-7 w-7 rounded-md grid place-items-center text-[11px] font-semibold text-white shrink-0"
      style={{ background: brand.color }}
    >
      {brand.logoText}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();
  const { workspaces, current, setCurrentId } = useWorkspace();
  const brand = useBrand();
  const { user, logout, configured } = useAuth();

  return (
    <div
      className="grid h-dvh"
      style={{
        gridTemplateColumns: "248px 1fr",
        gridTemplateRows: "auto 1fr",
      }}
      data-testid="app-shell"
    >
      <aside
        className="row-span-2 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col overflow-y-auto"
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-sidebar-border">
          <BrandMark />
          <div className="font-semibold tracking-tight text-[15px]">{brand.name}</div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => {
            const active = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm hover-elevate ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 px-2 mb-2">
            Workspace
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="button-workspace-switcher"
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover-elevate text-left"
              >
                <div
                  className="h-7 w-7 rounded-md grid place-items-center text-[11px] font-semibold shrink-0"
                  style={{ background: current?.brandColor || brand.color, color: "white" }}
                >
                  {current?.logoText || current?.name?.[0] || "W"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{current?.name || "Pick a workspace"}</div>
                  <div className="text-xs text-sidebar-foreground/50 truncate">
                    {current?.industry || "—"}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onSelect={() => setCurrentId(w.id)}
                  data-testid={`item-workspace-${w.id}`}
                >
                  <div
                    className="h-5 w-5 rounded grid place-items-center text-[10px] font-semibold mr-2 text-white"
                    style={{ background: w.brandColor || brand.color }}
                  >
                    {w.logoText || w.name[0]}
                  </div>
                  <div className="flex-1">{w.name}</div>
                  {current?.id === w.id && <span className="text-xs text-muted-foreground">●</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <header
        className="bg-background/80 backdrop-blur border-b border-border sticky top-0 z-10 flex items-center justify-between px-6 py-3"
        data-testid="app-header"
      >
        <div className="text-[13px] text-muted-foreground">
          <span className="text-foreground font-medium capitalize">
            {NAV.find((n) => n.href === location)?.label ?? "Page"}
          </span>
          <span className="mx-2 opacity-40">/</span>
          <span>{current?.name || "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            data-testid="button-theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {configured && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-user-menu">
                  {user.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => logout()} data-testid="item-logout">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <main
        className="overflow-y-auto bg-background"
        style={{ overscrollBehavior: "contain" }}
        data-testid="main-content"
      >
        {children}
      </main>
    </div>
  );
}
