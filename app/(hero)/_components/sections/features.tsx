import { Check, LayoutGrid, MousePointerClick } from "lucide-react";

import { Frame } from "../frame";
import { Cell, CellGrid, SectionIntro, displayFont } from "../landing-ui";
import { DomainDemo, BatchDemo } from "./features-delivery";
import { EditorDemo } from "./features-editor";
import { FeaturesMotion } from "./features-kit";
import { FoldersDemo, ImportDemo, SuppressionDemo } from "./features-audience";
import { AnalyticsDemo, AutomationDemo, FormsDemo, ScheduleDemo } from "./features-results";

// What the product does, as ten small pieces of it you can try. The grid has
// six columns on desktop, laid out 6 / 3+3 / 2+2+2 / 4+2 / 3+3; two columns
// on tablets, where the wide cells take a full row; one column on phones.
//
// Every claim here is something the app does today. Before adding a cell,
// find the feature in the code. Sample data is invented and tells one story:
// Northfield Arts Council, sending from northfieldarts.example.org to people
// on example.com and example.org, so nothing reads as a real customer.

const EDITOR_POINTS = [
  "Compiles to table-based HTML that holds up in Outlook.",
  "Warns you when an email is big enough for Gmail to clip.",
  "Drag blocks into place, or click to add them.",
];

export function Features() {
  return (
    <Frame id="features">
      <SectionIntro
        icon={LayoutGrid}
        eyebrow="Features"
        title="Everything between draft and delivered"
        description="Ten things LetterStack does, each as a small demo you can try. The names and numbers in them are made up."
      />

      <FeaturesMotion>
        <CellGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-6">
          {/* The wide cell: words on the left, the editor on the right. */}
          <div className="grid bg-white md:col-span-2 lg:col-span-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
            <div className="flex flex-col px-6 pb-6 sm:px-8 sm:pb-8 lg:py-8 lg:pr-4">
              <h3
                className="text-2xl leading-tight font-semibold tracking-tight text-neutral-950 sm:text-[28px]"
                style={displayFont}
              >
                Build the email from blocks
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-pretty text-neutral-500 sm:text-[15px]">
                Headings, images, buttons, columns, social links and a footer. Put them
                in order and the email is written, with no HTML to touch.
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {EDITOR_POINTS.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm leading-snug text-neutral-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#6C5ED1]" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
              {/* On narrower screens the same hint sits under the editor. */}
              <p className="mt-auto hidden items-center gap-2 pt-8 text-[13px] text-neutral-500 lg:flex">
                <MousePointerClick className="size-4 shrink-0" aria-hidden />
                Pick a block to put it in the email or take it out.
              </p>
            </div>
            <div className="order-first lg:order-none">
              <EditorDemo />
            </div>
          </div>

          <Cell
            className="lg:col-span-3"
            visual={<DomainDemo />}
            title="Send from your own domain"
            description="Add the DNS records we give you and campaigns go out through Amazon SES, signed with DKIM and a custom MAIL FROM for your domain."
          />
          <Cell
            className="lg:col-span-3"
            visual={<BatchDemo />}
            title="A retry never mails anyone twice"
            description="Campaigns go out in batches of 50. Each address is claimed before it is sent, so resuming a stalled send reaches only the people still waiting."
          />

          <Cell
            className="lg:col-span-2"
            visual={<ImportDemo />}
            title="Import a spreadsheet"
            description="Upload CSV or Excel. The email and name columns are matched for you, and duplicates and invalid addresses are left out."
          />
          <Cell
            className="lg:col-span-2"
            visual={<FoldersDemo />}
            title="Send to one folder or several"
            description="Sort contacts into folders and pick any mix for a campaign. Someone in two of them still gets one email."
          />
          <Cell
            className="md:col-span-2 lg:col-span-2"
            visual={<SuppressionDemo />}
            title="Bounces suppress themselves"
            description="Hard bounces and spam complaints go onto your suppression list as they arrive. Every later send skips them."
          />

          <Cell
            className="md:col-span-2 lg:col-span-4"
            visual={<AnalyticsDemo />}
            title="A report for every campaign"
            description="Delivered, opened, clicked, bounced and complained, counted for each campaign and added up across the workspace."
          />
          <Cell
            className="lg:col-span-2"
            visual={<ScheduleDemo />}
            title="Schedule it for later"
            description="Pick a day and a time, and the campaign goes out then. You can cancel any time before it does."
          />

          <Cell
            className="lg:col-span-3"
            visual={<AutomationDemo />}
            title="Welcome new contacts automatically"
            description="Start when a contact is added, wait, branch on a condition and send. You draw the flow on a canvas, step by step."
          />
          <Cell
            className="md:col-span-2 lg:col-span-3"
            visual={<FormsDemo />}
            title="Signup forms for your site"
            description="Embed a form in the page, as a popup, or sliding in from a corner. People who sign up join your audience and can start your welcome flow."
          />
        </CellGrid>
      </FeaturesMotion>
    </Frame>
  );
}
