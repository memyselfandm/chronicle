import { Header } from "@/components/layout/Header";
import { DashboardWithFallback } from "@/components/DashboardWithFallback";
import { SidebarContainer } from "@/components/sidebar/SidebarContainer";

export default function Dashboard() {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-hidden flex">
        {/* Sidebar */}
        <SidebarContainer />
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <DashboardWithFallback />
          </div>
        </div>
      </main>
    </>
  );
}
