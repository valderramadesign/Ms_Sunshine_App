import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
import { ActivityProvider } from "@/lib/activityStore";
import { useRealtimeSync } from "@/lib/useRealtimeSync";

function RootRoute() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/home", { replace: true });
  }, [setLocation]);
  return <div className="flex h-dvh items-center justify-center bg-[#f5f5f5]" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/home" component={Home} />
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
  );
}

function RealtimeWrapper({ children }: { children: React.ReactNode }) {
  useRealtimeSync(true);
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
