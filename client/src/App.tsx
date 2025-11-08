import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import Materials from "@/pages/materials";
import Chat from "@/pages/chat";
import Flashcards from "@/pages/flashcards";
import Quizzes from "@/pages/quizzes";
import Summaries from "@/pages/summaries";
import Todos from "@/pages/todos";
import Pomodoro from "@/pages/pomodoro";
import Concentration from "@/pages/concentration";
import Leaderboard from "@/pages/leaderboard";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/profile" component={Profile} />
          <Route path="/materials" component={Materials} />
          <Route path="/chat" component={Chat} />
          <Route path="/flashcards" component={Flashcards} />
          <Route path="/quizzes" component={Quizzes} />
          <Route path="/summaries" component={Summaries} />
          <Route path="/todos" component={Todos} />
          <Route path="/pomodoro" component={Pomodoro} />
          <Route path="/concentration" component={Concentration} />
          <Route path="/leaderboard" component={Leaderboard} />
          {/* Add more authenticated routes here */}
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <>
      {isLoading || !isAuthenticated ? (
        <>
          <Toaster />
          <Router />
        </>
      ) : (
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between p-4 border-b">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-y-auto">
                <Router />
              </main>
            </div>
          </div>
          <Toaster />
        </SidebarProvider>
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
