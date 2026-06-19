"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/templates", label: "Templates" },
  { href: "/dashboard/contacts", label: "Audience" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-dvh bg-zinc-50 text-zinc-900">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white p-4">
        <div className="px-2 text-sm font-bold tracking-tight">LetterStack</div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
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

        {session?.user && (
          <div className="mt-auto border-t border-zinc-200 pt-4">
            <div className="truncate px-2 text-sm font-medium text-zinc-800">
              {session.user.name || session.user.email}
            </div>
            <div className="truncate px-2 text-xs text-zinc-400">
              {session.user.email}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="mt-2 w-full rounded-lg px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Sign out
            </button>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
