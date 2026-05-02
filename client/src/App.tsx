import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/themeContext";
import { WorkspaceProvider } from "@/lib/workspaceContext";
import { BrandProvider } from "@/lib/brandContext";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { AppShell } from "@/components/AppShell";
import Overview from "@/pages/Overview";
import Sources from "@/pages/Sources";
import Generate from "@/pages/Generate";
import Library from "@/pages/Library";
import Schedules from "@/pages/Schedules";
import Settings from "@/pages/Settings";
import Connections from "@/pages/Connections";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Overview} />
      <Route path="/sources" component={Sources} />
      <Route path="/generate" component={Generate} />
      <Route path="/library" component={Library} />
      <Route path="/schedules" component={Schedules} />
      <Route path="/connections" component={Connections} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate() {
  const { user, configured, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  // If auth isn't configured at all, behave like dev mode and skip the gate.
  if (!user && configured) {
    return <Login />;
  }
  return (
    <WorkspaceProvider>
      <AppShell>
        <AppRouter />
      </AppShell>
    </WorkspaceProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router hook={useHashLocation}>
              <AuthProvider>
                <AuthGate />
              </AuthProvider>
            </Router>
          </TooltipProvider>
        </ThemeProvider>
      </BrandProvider>
    </QueryClientProvider>
  );
}

export default App;
