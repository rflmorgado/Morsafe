export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[14px] border border-border-subtle bg-surface p-[18px] ${className}`}
    >
      {children}
    </div>
  );
}
