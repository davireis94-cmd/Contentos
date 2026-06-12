function LumioAuthIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="20,37 3,15 10,12" fill="#3B6BF0" />
      <polygon points="20,37 10,12 15.5,9" fill="#7B52E0" />
      <polygon points="20,37 15.5,9 24.5,9" fill="#C03870" />
      <polygon points="20,37 24.5,9 30,12" fill="#E05428" />
      <polygon points="20,37 30,12 37,15" fill="#F0A010" />
      <circle cx="20" cy="5.5" r="3.2" fill="none" stroke="#F0A010" strokeWidth="2" />
    </svg>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LumioAuthIcon />
          <div>
            <p
              className="text-2xl font-bold tracking-tight text-white"
              style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
            >
              Lumio
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-sidebar-foreground/35">
              Transforme ideias em influência
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
