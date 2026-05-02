import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/themeContext";
import { WorkspaceProvider } from "@/lib/workspaceContext";
import { AppShell } from "@/components/AppShell";
import Overview from "@/pages/Overview";
import Sources from "@/pages/Sources";
import Generate from "@/pages/Generate";
import Library from "@/pages/Library";
import Schedules from "@/pages/Schedules";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Overview} />
      <Route path="/sources" component={Sources} />
      <Route path="/generate" component={Generate} />
      <Route path="/library" component={Library} />
      <Route path="/schedules" component={Schedules} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <WorkspaceProvider>
              <AppShell>
                <AppRouter />
              </AppShell>
            </WorkspaceProvider>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
