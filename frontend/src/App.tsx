import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppProvider } from "@/store/app-store";
import Dashboard from "./pages/Dashboard";
import MapViewer from "./pages/MapViewer";
import TrafficSigns from "./pages/TrafficSigns";
import RoutePlanner from "./pages/RoutePlanner";
import ExportPage from "./pages/ExportPage";
import Analysis from "./pages/Analysis";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <SidebarProvider>
            <div className="min-h-screen flex w-full">
              <AppSidebar />
              <div className="flex-1 flex flex-col min-h-screen">
                <header className="h-11 flex items-center border-b border-border bg-card/50 flex-shrink-0">
                  <SidebarTrigger className="ml-2" />
                </header>
                <main className="flex-1 flex flex-col overflow-hidden">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/viewer" element={<MapViewer />} />
                    <Route path="/signs" element={<TrafficSigns />} />
                    <Route path="/route-planner" element={<RoutePlanner />} />
                    <Route path="/export" element={<ExportPage />} />
                    <Route path="/analysis" element={<Analysis />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
              </div>
            </div>
          </SidebarProvider>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
