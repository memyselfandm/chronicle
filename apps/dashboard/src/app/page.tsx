import { Header } from "@/components/layout/Header";

export default function Dashboard() {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Dashboard content will be added here */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-semibold text-text-primary">
                Chronicle Dashboard
              </h1>
              <p className="text-lg text-text-secondary max-w-md">
                Multi-Agent Observability Dashboard for Claude Code agent activities. 
                Real-time monitoring across multiple projects and sessions.
              </p>
              <div className="mt-8 space-y-2">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-bg-secondary border border-border">
                  <div className="w-2 h-2 bg-accent-yellow rounded-full mr-2 animate-pulse"></div>
                  Initializing connection...
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
