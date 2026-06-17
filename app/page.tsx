import Link from "next/link";

// Landing page. No auth yet — just a front door into the dashboard.
export default function Landing() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6 text-center">
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
        LetterStack
      </span>
      <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
        Newsletters from your own domain, sent properly.
      </h1>
      <p className="mt-4 max-w-xl text-zinc-500">
        Build an email, load your list, and send in batches through Amazon SES —
        no clipping, no image-flattening, no lock-in.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Open dashboard
        </Link>
        <Link
          href="/editor-new"
          className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Open editor
        </Link>
      </div>
    </main>
  );
}
