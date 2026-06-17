import Link from "next/link";

// The dashboard home: the two things you actually do — make an email, send it.
const ACTIONS = [
  {
    href: "/editor-new",
    title: "Create a template",
    body: "Open the editor and design your newsletter.",
    cta: "Open editor →",
  },
  {
    href: "/dashboard/send",
    title: "Send a campaign",
    body: "Manage recipients, fire a send, and keep your do-not-mail list.",
    cta: "Go to send →",
  },
];

export default function DashboardHome() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-zinc-500">Your mailing control center.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-sm"
          >
            <h2 className="text-lg font-semibold">{a.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{a.body}</p>
            <span className="mt-4 inline-block text-sm font-medium text-zinc-900 group-hover:underline">
              {a.cta}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
