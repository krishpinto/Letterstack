import Link from "next/link";

import { Footer } from "./footer";

/**
 * Shared rendering for the legal pages.
 *
 * The prose lives in plain strings rather than JSX so the text reads as
 * text when you edit it — no &rsquo; thicket from react/no-unescaped-entities
 * — and so a section can be moved or reworded without touching markup.
 */
export type LegalBlock =
  | string
  | { subheading: string }
  | { list: string[] }
  | { note: string };

export type LegalSection = {
  id: string;
  heading: string;
  blocks: LegalBlock[];
};

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (typeof block === "string") {
          return (
            <p key={i} className="mt-4 text-[15px] leading-7 text-[#3F3F46]">
              {block}
            </p>
          );
        }
        if ("subheading" in block) {
          return (
            <h3
              key={i}
              className="mt-8 text-base font-semibold text-[#0A0A0A]"
            >
              {block.subheading}
            </h3>
          );
        }
        if ("note" in block) {
          return (
            <p
              key={i}
              className="mt-4 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3 text-[14px] leading-6 text-[#3F3F46]"
            >
              {block.note}
            </p>
          );
        }
        return (
          <ul key={i} className="mt-4 flex flex-col gap-2">
            {block.list.map((item, j) => (
              <li
                key={j}
                className="flex gap-3 text-[15px] leading-7 text-[#3F3F46]"
              >
                <span aria-hidden className="mt-[11px] size-1 shrink-0 rounded-full bg-[#A1A1AA]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </>
  );
}

export function LegalShell({
  title,
  updated,
  summary,
  sections,
}: {
  title: string;
  /** Human-readable date, e.g. "28 August 2026". */
  updated: string;
  /** One paragraph in plain language, before the formal text. */
  summary: string;
  sections: LegalSection[];
}) {
  return (
    <div className="flex flex-1 flex-col bg-white font-sans">
      <div className="mx-auto w-full max-w-3xl px-6 pb-20 pt-32 lg:px-0 lg:pt-40">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#A1A1AA]">
          Legal
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[#0A0A0A] sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-[#717171]">Last updated {updated}</p>

        <p className="mt-8 border-l-2 border-[#E4E4E7] pl-5 text-[15px] leading-7 text-[#3F3F46]">
          {summary}
        </p>

        {/* Contents. Short enough to be worth having, long enough to need it. */}
        <nav aria-label="Contents" className="mt-10 border-y border-dashed border-[#E4E4E7] py-6">
          <ol className="flex flex-col gap-1.5">
            {sections.map((section, i) => (
              <li key={section.id} className="text-[14px] leading-6">
                <Link
                  href={`#${section.id}`}
                  className="text-[#3F3F46] underline-offset-4 hover:text-[#0A0A0A] hover:underline"
                >
                  <span className="tabular-nums text-[#A1A1AA]">{i + 1}.</span>{" "}
                  {section.heading}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((section, i) => (
          <section key={section.id} id={section.id} className="scroll-mt-28 pt-12">
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-[#0A0A0A]">
              <span className="tabular-nums text-[#A1A1AA]">{i + 1}.</span>{" "}
              {section.heading}
            </h2>
            <Blocks blocks={section.blocks} />
          </section>
        ))}
      </div>

      <Footer />
    </div>
  );
}
