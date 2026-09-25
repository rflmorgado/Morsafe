export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-surface p-[18px] shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
