import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index.tsx";
import Welcome from "./pages/Welcome.tsx";
import CreateEvent from "./pages/CreateEvent.tsx";
import EventDetail from "./pages/EventDetail.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import Settings from "./pages/Settings.tsx";
import Archive from "./pages/Archive.tsx";
import InviteFriend from "./pages/InviteFriend.tsx";
import AcceptInvite from "./pages/AcceptInvite.tsx";
import HeartedEvents from "./pages/HeartedEvents.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/create" element={<CreateEvent />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/invite" element={<InviteFriend />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/hearted" element={<HeartedEvents />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
