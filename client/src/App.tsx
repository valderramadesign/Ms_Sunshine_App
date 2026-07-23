import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Home } from "@/pages/Home";
import { SelectChildren } from "@/pages/SelectChildren";
import { SelectItems } from "@/pages/SelectItems";
import { Success } from "@/pages/Success";
import { School } from "@/pages/School";
import { ChildFeed } from "@/pages/ChildFeed";
import { AddChild } from "@/pages/AddChild";
import { AddTeacher } from "@/pages/AddTeacher";
import { AddGuardian } from "@/pages/AddGuardian";
import { ChildDetails } from "@/pages/ChildDetails";
import { TeacherDetails } from "@/pages/TeacherDetails";
import { GuardianDetails } from "@/pages/GuardianDetails";
import { AddNoteAndPhotos } from "@/pages/AddNoteAndPhotos";
import { AdminOnboarding } from "@/pages/AdminOnboarding";
import { AdminInfo } from "@/pages/AdminInfo";
import { AdminLogin } from "@/pages/AdminLogin";
import { InviteOnboarding } from "@/pages/InviteOnboarding";
import { ResetPassword } from "@/pages/ResetPassword";
import { ParentChildren } from "@/pages/ParentChildren";
import { ActivityProvider } from "@/lib/activityStore";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import { useAuth, roleHome, type Role } from "@/lib/auth";

// Public routes that never require authentication.
const PUBLIC_PATHS = new Set(["/", "/onboarding/admin", "/onboarding/admin-info"]);

function isPathAllowed(role: Role, path: string, childIds: string[] = []): boolean {
  if (role === "admin") return true;
  const p = path.split("?")[0];

  if (role === "teacher") {
    if (p === "/school") return false;
    if (p === "/school/add" || p === "/school/add-teacher" || p === "/school/add-guardian") return false;
    if (p.startsWith("/school/teacher/") || p.startsWith("/school/guardian/")) return false;
    if (p === "/children") return false;
    return true;
  }

  if (role === "parent") {
    if (p === "/children") return true;
    const segs = p.split("/").filter(Boolean);
    if (segs[0] === "school" && segs.length === 2) {
      const id = segs[1];
      if (["add", "add-teacher", "add-guardian"].includes(id)) return false;
      // Only allow access to the specific child IDs the server returned for this parent.
      return childIds.includes(id);
    }
    return false;
  }

  return false;
}

function RootRoute() {
  const [, setLocation] = useLocation();
  const { data: adminStatus, isLoading: adminLoading } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/admin/status"],
  });
  const { role, childIds, isLoading: authLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (adminLoading || authLoading) return;
    if (!adminStatus?.exists) {
      setLocation("/onboarding/admin");
      return;
    }
    if (isAuthenticated && role) {
      setLocation(roleHome(role, childIds));
    }
  }, [adminLoading, authLoading, adminStatus, isAuthenticated, role, childIds, setLocation]);

  const loading = adminLoading || authLoading || (adminStatus?.exists && isAuthenticated);
  if (loading) return <div className="flex h-dvh items-center justify-center bg-[#f5f5f5]" />;

  return <AdminLogin />;
}

function RouteGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { role, childIds, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    const path = location.split("?")[0];
    if (PUBLIC_PATHS.has(path) || path.startsWith("/invite/") || path.startsWith("/reset-password/")) return;
    if (!isAuthenticated) {
      setLocation("/");
      return;
    }
    if (role && !isPathAllowed(role, location, childIds)) {
      setLocation(roleHome(role, childIds));
    }
  }, [isLoading, isAuthenticated, role, location, childIds, setLocation]);

  return <>{children}</>;
}

function Router() {
  return (
    <RouteGuard>
      <Switch>
        <Route path="/" component={RootRoute} />
        <Route path="/onboarding/admin" component={AdminOnboarding} />
        <Route path="/onboarding/admin-info" component={AdminInfo} />
        <Route path="/invite/:token" component={InviteOnboarding} />
        <Route path="/reset-password/:token" component={ResetPassword} />
        <Route path="/home" component={Home} />
        <Route path="/children" component={ParentChildren} />
        <Route path="/select-children" component={SelectChildren} />
        <Route path="/select-items" component={SelectItems} />
        <Route path="/add-note" component={AddNoteAndPhotos} />
        <Route path="/success" component={Success} />
        <Route path="/school" component={School} />
        <Route path="/school/add" component={AddChild} />
        <Route path="/school/add-teacher" component={AddTeacher} />
        <Route path="/school/add-guardian" component={AddGuardian} />
        <Route path="/school/teacher/:teacherId" component={TeacherDetails} />
        <Route path="/school/guardian/:guardianKey" component={GuardianDetails} />
        <Route path="/school/:childId/details" component={ChildDetails} />
        <Route path="/school/:childId" component={ChildFeed} />
        <Route component={NotFound} />
      </Switch>
    </RouteGuard>
  );
}

function RealtimeWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  useRealtimeSync(isAuthenticated);
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeWrapper>
        <ActivityProvider>
          <TooltipProvider>
            <Toaster />
            <OfflineBanner />
            <div className="app-shell">
              <div className="app-frame">
                <Router />
              </div>
            </div>
          </TooltipProvider>
        </ActivityProvider>
      </RealtimeWrapper>
    </QueryClientProvider>
  );
}

export default App;
