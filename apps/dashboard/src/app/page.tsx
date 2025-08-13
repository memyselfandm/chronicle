import { Header } from "@/components/layout/Header";
import { EventDashboard } from "@/components/EventDashboard";

export default function Dashboard() {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <EventDashboard />
          </div>
        </div>
      </main>
    </>
  );
}
