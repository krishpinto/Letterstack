"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The dashboard's own simple shell: a left nav + a content area. Separate from
// the partner's editor sidebar so the two halves don't collide.
const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/send", label: "Send" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/editor-new", label: "Create template ↗" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh bg-zinc-50 text-zinc-900">
      <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white p-4">
        <div className="px-2 text-sm font-bold tracking-tight">LetterStack</div>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
