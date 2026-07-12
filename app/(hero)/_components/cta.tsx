import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ContactSalesScreen } from "./contact-sales-screen";

// Closing CTA band above the footer: one big claim, two ways in. The
// "Contact us" pill morphs into the full contact screen.

export function CtaSection() {
  return (
    <section
      id="contact"
      className="scroll-mt-24 border-t border-[#E4E4E7] bg-white py-28 lg:py-36"
    >
      <div className="mx-auto max-w-screen-xl px-6 text-center lg:px-10">
        <h2
          className="text-4xl font-bold leading-[1.05] tracking-tight text-[#0A0A0A] sm:text-5xl lg:text-6xl"
          style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
        >
          Built for real newsletters.
          <br />
          Ready when you are.
        </h2>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="rounded-full" asChild>
            <Link href="/signup">Get started</Link>
          </Button>
          <ContactSalesScreen />
        </div>
      </div>
    </section>
  );
}
