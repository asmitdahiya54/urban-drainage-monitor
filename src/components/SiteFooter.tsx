export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface text-surface-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display font-semibold">Urban Drainage Monitor</p>
        <p className="opacity-70">
          A community &amp; SDG-aligned civic technology project. Stage 11 — security hardening.
          Civic / environmental data (demo data, not official).
        </p>
      </div>
    </footer>
  );
}
