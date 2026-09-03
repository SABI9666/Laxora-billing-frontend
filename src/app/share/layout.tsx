// Public, read-only pages opened from a share link — no login, no sidebar.
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6 sm:py-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-sheet, .sheet { border: none !important; box-shadow: none !important; }
        }
      `}</style>
      {children}
    </div>
  );
}
