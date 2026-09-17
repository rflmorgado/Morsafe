"use client";

import { useRouter } from "next/navigation";

export function ClickableRow({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <tr
      onClick={() => router.push(href)}
      className={`cursor-pointer border-b border-border-subtle transition last:border-b-0 hover:bg-brand-50 ${className}`}
    >
      {children}
    </tr>
  );
}
