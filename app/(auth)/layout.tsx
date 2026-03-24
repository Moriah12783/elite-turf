import LogoEliteTurf from "@/components/ui/LogoEliteTurf";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Top bar */}
      <div className="p-4 sm:p-6">
        <LogoEliteTurf size="md" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>

      {/* Footer note */}
      <div className="p-4 text-center">
        <p className="text-text-muted text-xs">
          © 2026 Elite Turf · Les pronostics sont fournis à titre informatif
        </p>
      </div>
    </div>
  );
}
