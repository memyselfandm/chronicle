"use client";

export function Header() {

  return (
    <header className="bg-bg-secondary border-b border-border">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Chronicle title and logo area */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-accent-blue rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-text-primary">
                  Chronicle
                </h1>
                <p className="text-sm text-text-muted">
                  Observability Platform
                </p>
              </div>
            </div>
          </div>

          {/* Right: Basic navigation */}
          <nav className="flex items-center space-x-4">
            <button
              className="text-sm text-text-muted hover:text-text-secondary transition-colors duration-200"
              title="Settings (Coming Soon)"
              disabled
            >
              Settings
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}