import { Header } from "@/components/layout/Header";
import { ProductionEventDashboard } from "@/components/ProductionEventDashboard";

export default function Dashboard() {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <ProductionEventDashboard />
          </div>
        </div>
      </main>
    </>
  );
}
