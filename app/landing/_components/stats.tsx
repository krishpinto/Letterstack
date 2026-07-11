const STATS = [
  { value: "4.2B+",  label: "Emails delivered"       },
  { value: "99.4%",  label: "Average delivery rate"   },
  { value: "40k+",   label: "Teams sending today"     },
];

export function Stats() {
  return (
    <section className="border-y border-[#E4E4E7] py-28 lg:py-36">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10">
        {/* Eyebrow */}
        <p className="mb-14 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#717171]">
          Numbers that matter
        </p>

        <div className="grid divide-y divide-[#E4E4E7] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {STATS.map(({ value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 py-10 sm:py-0"
            >
              <span
                className="text-[4.5rem] font-bold leading-none tracking-tighter text-[#0A0A0A] lg:text-[5.5rem]"
                style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
              >
                {value}
              </span>
              <span className="text-base text-[#717171]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
