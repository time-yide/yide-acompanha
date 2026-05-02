export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0e14] p-4">
      {/* Gradient-mesh background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Blob turquesa principal — top left */}
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,#3DC4BC_0%,transparent_60%)] opacity-40 blur-3xl animate-blob-slow" />
        {/* Blob azul-marinho — bottom right */}
        <div className="absolute -bottom-40 -right-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle_at_center,#0c4a6e_0%,transparent_60%)] opacity-50 blur-3xl animate-blob-slower" />
        {/* Blob roxo sutil — middle */}
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,#22d3ee_0%,transparent_60%)] opacity-20 blur-3xl animate-blob-medium" />
        {/* Vinheta sutil pra escurecer as bordas */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
