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
import Templates from "@/pages/Templates";
import TemplateBuild from "@/pages/TemplateBuild";
import Recipes from "@/pages/Recipes";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
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
      <Route path="/recipes" component={Recipes} />
      <Route path="/templates/:id" component={TemplateBuild} />
      <Route path="/templates" component={Templates} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Routes the unauthenticated visitor can hit. /pricing and / (landing)
// are public marketing pages — they don't need auth. Everything else
// falls through to <Login /> when auth is configured.
function PublicRouter() {
  return (
    <Switch>
      <Route path="/pricing" component={Pricing} />
      <Route path="/login" component={Login} />
      <Route path="/" component={Landing} />
      <Route component={Landing} />
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
    return <PublicRouter />;
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
