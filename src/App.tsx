import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index.tsx";
import CreateEvent from "./pages/CreateEvent.tsx";
import EventDetail from "./pages/EventDetail.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import Settings from "./pages/Settings.tsx";
import SettingsAccount from "./pages/SettingsAccount.tsx";
import SettingsNotifications from "./pages/SettingsNotifications.tsx";
import SettingsCircle from "./pages/SettingsCircle.tsx";
import SettingsPastEvents from "./pages/SettingsPastEvents.tsx";
import SettingsHelp from "./pages/SettingsHelp.tsx";
import SettingsPayment from "./pages/SettingsPayment.tsx";
import Archive from "./pages/Archive.tsx";
import InviteFriend from "./pages/InviteFriend.tsx";
import AcceptInvite from "./pages/AcceptInvite.tsx";
import HeartedEvents from "./pages/HeartedEvents.tsx";
import JoinPage from "./pages/JoinPage.tsx";
import PendingApproval from "./pages/PendingApproval.tsx";
import AdminMembers from "./pages/AdminMembers.tsx";
import SeriesEvents from "./pages/SeriesEvents.tsx";
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

            {/* /welcome → /join (permanent redirect — old URL kept alive) */}
            <Route path="/welcome" element={<Navigate to="/join" replace />} />

            {/* Public landing / auth */}
            <Route path="/join" element={<JoinPage />} />
            <Route path="/join/:inviteCode" element={<JoinPage />} />

            {/* App */}
            <Route path="/create" element={<CreateEvent />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/account" element={<SettingsAccount />} />
            <Route path="/settings/notifications" element={<SettingsNotifications />} />
            <Route path="/settings/circle" element={<SettingsCircle />} />
            <Route path="/settings/past-events" element={<SettingsPastEvents />} />
            <Route path="/settings/help" element={<SettingsHelp />} />
            <Route path="/settings/payment" element={<SettingsPayment />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/invite" element={<InviteFriend />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/hearted" element={<HeartedEvents />} />
            <Route path="/pending" element={<PendingApproval />} />
            <Route path="/admin/members" element={<AdminMembers />} />
            <Route path="/series/:parentId" element={<SeriesEvents />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
