// Shared event and admin navigation stays readable in a solid sticky strip.
// It renders on the server with zero client JavaScript.
export default function HeaderBar({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      {children}
    </header>
  );
}
