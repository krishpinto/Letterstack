import type { Metadata } from "next";

import { LegalShell, type LegalSection } from "../_components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — LetterStack",
  description:
    "How LetterStack collects, uses, shares and protects personal data, including data received from Google APIs.",
};

const UPDATED = "3 September 2026";

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    heading: "Who we are",
    blocks: [
      "LetterStack is an email campaign platform operated by [YOUR FULL NAME], a sole proprietor based in [CITY], [STATE], India, trading as LetterStack. In this policy, LetterStack, we, us and our mean that business. The service is available at letterstack.site.",
      "You can reach us about anything in this policy at privacy@letterstack.site. Under the Digital Personal Data Protection Act, 2023, that address also reaches the person responsible for answering data protection grievances.",
    ],
  },
  {
    id: "two-roles",
    heading: "Two different roles, and why the difference matters",
    blocks: [
      "LetterStack handles personal data in two distinct capacities, and your rights differ depending on which one applies.",
      { subheading: "As a controller, for our own customers" },
      "When you sign up, pay us, or use the product, we decide why and how your personal data is processed. That is data about you as an account holder: your name, email address, workspace, and billing records. This policy governs that data in full.",
      { subheading: "As a processor, for the contact lists you upload" },
      "When you import a mailing list, that list belongs to you. The people on it are your subscribers, not ours. We process their data only to carry out the sending, suppression and reporting you ask for, on your instructions, and we do not use it for our own purposes, sell it, or send it anything of our own.",
      {
        note: "If you received an email sent through LetterStack and want your data corrected or deleted, the organisation that sent it is the right place to ask, because they control the list. You can also write to privacy@letterstack.site and we will route it to them and honour any unsubscribe or suppression request ourselves.",
      },
    ],
  },
  {
    id: "what-we-collect",
    heading: "What we collect",
    blocks: [
      { subheading: "Account and workspace data" },
      {
        list: [
          "Your name and email address, and a bcrypt hash of your password. We never store the password itself.",
          "If you sign in with Google, the basic profile information Google returns: your name, email address, and profile picture URL.",
          "The workspaces you create or join, your role in each, and invitations you send or accept.",
          "Password reset tokens, which expire and are single-use.",
        ],
      },
      { subheading: "Billing data" },
      {
        list: [
          "Which plan a workspace is on, when its period started and ends, and whether it came from a payment or an admin grant.",
          "A record of each payment: amount, currency, status, and the identifiers our payment processor returns.",
          "We never see or store your full card number, CVV, UPI PIN or bank credentials. Those go directly to Razorpay, our payment processor, and never touch our servers.",
        ],
      },
      { subheading: "Contact lists you upload" },
      {
        list: [
          "Email addresses and, where you provide them, names of the people on your lists.",
          "Categories or folders you organise them into.",
          "A per-workspace suppression list of addresses that must never be contacted again, built from hard bounces, spam complaints and unsubscribes.",
        ],
      },
      { subheading: "Campaign and delivery data" },
      {
        list: [
          "The campaigns and templates you build, including their content, and the frozen HTML snapshot of what was actually sent.",
          "Delivery events reported back by our sending provider: sends, deliveries, bounces, spam complaints, opens and clicks, with the timestamp and recipient address each relates to.",
          "Sending domains you verify, and their DNS verification status.",
          "Signup forms you publish and the submissions they receive.",
        ],
      },
      { subheading: "Content you put into the AI editor" },
      "If you use the AI assistant, the text of your prompt and the email content in scope of your request are sent to Google as our model provider so it can generate a response. We also record a per-workspace count of AI requests in order to enforce quota.",
      { subheading: "Technical data" },
      "Server and application logs, which may include IP addresses, browser user agent, and the pages or API routes accessed, kept for security, debugging and abuse investigation.",
      {
        note: "We do not run advertising trackers or third-party analytics scripts on the product, and we do not sell personal data to anyone, in either of our roles.",
      },
    ],
  },
  {
    id: "google-data",
    heading: "Google user data, including Gmail",
    blocks: [
      "LetterStack offers two optional features that use Google accounts. Both are opt-in and neither is required to use the product.",
      { subheading: "Signing in with Google" },
      "If you choose Google sign-in, we receive your name, email address and profile picture URL, and use them only to create and identify your account.",
      { subheading: "Connecting a Gmail account to send from" },
      "If you connect Gmail, you grant LetterStack the https://www.googleapis.com/auth/gmail.send scope. That scope permits one thing: sending mail as you. It does not permit reading, searching, downloading, modifying or deleting anything in your mailbox, and we do not attempt to do any of those things.",
      "We use that permission for exactly one purpose: delivering the campaigns you tell us to send, from the Gmail account you connected. We store the OAuth access and refresh tokens Google issues so that scheduled sends can run without you being present. Tokens are stored encrypted, are never shared with anyone, and are used for nothing else.",
      "You can disconnect at any time from your LetterStack settings, or revoke our access directly at myaccount.google.com/permissions. On disconnection or revocation we delete the stored tokens. Campaigns already sent through the connection stay in your account history, because they are a record of what you sent.",
      {
        note: "LetterStack's use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
      },
      "In plain terms, that commitment means: we use Google user data only to provide and improve the features you asked for; we do not transfer it to others except as needed to provide those features, to comply with law, or as part of a merger or acquisition with notice to you; we do not use it for advertising; we do not sell it; and no human at LetterStack reads it except with your explicit consent, to resolve a support issue you raised, for security purposes such as investigating abuse, or where the law requires it.",
    ],
  },
  {
    id: "how-we-use",
    heading: "How we use personal data, and on what basis",
    blocks: [
      {
        list: [
          "To provide the service: creating your account, building and sending campaigns, importing lists, honouring unsubscribes, and showing delivery reporting. Basis: performance of our contract with you.",
          "To bill you and keep financial records. Basis: contract, and our legal obligation to retain tax records.",
          "To protect the service and our sending reputation: rate limiting, abuse detection, investigating bounce and complaint rates, and enforcing the acceptable use rules in our Terms. Basis: our legitimate interest in a service that stays deliverable for everyone on it, and, for Indian users, the legitimate uses permitted under the DPDP Act.",
          "To communicate with you about your account, service changes, security issues and billing. Basis: contract and legitimate interest. These are not marketing emails, and you cannot opt out of the essential ones while you hold an account.",
          "To meet legal obligations and respond to lawful requests. Basis: legal obligation.",
        ],
      },
      "Where the law requires consent, such as for optional integrations or for non-essential communications, we ask for it, and you can withdraw it at any time.",
      { subheading: "Review of campaigns you send" },
      "Every campaign is stored with a frozen copy of the exact email that went out, because that is what we send from and what we keep on record. Our operators can open that copy, together with the campaign's subject, sender, channel and recipient count, in an internal console protected by a named administrator allowlist. We are also notified when a campaign begins sending, by a message containing that same information and no subscriber addresses.",
      "We do this to keep the platform deliverable and lawful: to investigate bounce and complaint spikes, to answer a support question about a send, and to detect phishing or bulk unsolicited mail before it costs every other sender on our shared infrastructure their delivery. Basis: our legitimate interest in protecting the service, and the instruction you give us to send on your behalf.",
      {
        note: "We do not read your campaigns for our own commercial purposes, do not use their content to build products or train models, do not receive copies of the individual emails delivered to your subscribers, and do not add ourselves or anyone else to your recipient lists.",
      },
    ],
  },
  {
    id: "subprocessors",
    heading: "Who we share data with",
    blocks: [
      "We do not sell personal data and we do not share it for advertising. We do rely on a small number of infrastructure providers, each processing only what its function requires:",
      {
        list: [
          "Neon — managed PostgreSQL. Stores essentially all of the application data described above.",
          "Vercel — application hosting and edge delivery. Processes request data and server logs.",
          "Amazon Web Services (Simple Email Service), Mumbai region (ap-south-1) — sending email and reporting delivery events. Processes recipient addresses and message content.",
          "Google LLC — Google sign-in, the Gmail send integration where you enable it, and the Gemini models behind the AI editor. Processes the data described in the Google section above.",
          "Upstash (QStash) — the queue that fans a large send out into batches. Processes campaign and batch identifiers.",
          "UploadThing — hosting for images you upload into emails. Processes those image files.",
          "Razorpay — payment processing. Processes your payment details directly; we receive only the transaction record.",
          "Resend — a standby email sending provider, used only if our primary sending path is unavailable.",
        ],
      },
      "We may also disclose data where we are legally required to, to enforce our Terms, to protect the rights and safety of users or the public, or in connection with a merger, acquisition or sale of assets — in which case we will give you notice before your data becomes subject to a different privacy policy.",
    ],
  },
  {
    id: "transfers",
    heading: "Where data is processed",
    blocks: [
      "We send email from the AWS Mumbai region. Our other providers are established in, or operate infrastructure in, the United States and the European Union, so personal data may be processed outside India and outside your own country.",
      "Where data protected by UK or EU law is transferred out of those jurisdictions, our providers rely on Standard Contractual Clauses or an equivalent approved safeguard. We do not transfer personal data to any country to which such transfers are restricted by the Indian government.",
    ],
  },
  {
    id: "retention",
    heading: "How long we keep it",
    blocks: [
      {
        list: [
          "Account data: for as long as your account exists, and up to 90 days after you delete it, to allow recovery from mistaken deletion.",
          "Contact lists and campaign data: until you delete them, or until 90 days after your account is closed, whichever comes first.",
          "Suppression records: kept indefinitely, and deliberately so. An address that hard bounced or filed a spam complaint must stay suppressed even after the list containing it is deleted — otherwise deleting a list would silently re-enable mail to people who asked never to receive it.",
          "Delivery and event data: 24 months, after which it is aggregated or deleted.",
          "Payment records: as long as Indian tax and accounting law requires, currently up to 8 years.",
          "Server logs: typically 30 days, longer where retained for an open security investigation.",
          "Gmail OAuth tokens: until you disconnect or revoke, at which point they are deleted.",
        ],
      },
    ],
  },
  {
    id: "security",
    heading: "How we protect it",
    blocks: [
      {
        list: [
          "All traffic to and from the service runs over TLS. Data at rest in our database and object storage is encrypted by our providers.",
          "Passwords are stored only as bcrypt hashes, never in a recoverable form.",
          "Every database query is scoped to the requesting workspace, so one customer cannot read another's lists, campaigns or events.",
          "OAuth tokens are stored encrypted and are readable only by the send path that needs them.",
          "Administrative access is limited to a named allowlist of operators, and used only where support or investigation requires it. That access includes the stored copy of a sent campaign, as described under How we use personal data.",
        ],
      },
      {
        note: "No system is perfectly secure, and we will not pretend otherwise. LetterStack is an early-stage product run by a very small team, and we have not yet completed an independent security certification such as SOC 2 or ISO 27001. If you need one before entrusting us with a list, ask, and we will be straight with you about where we are.",
      },
      "If a breach affecting your personal data occurs, we will notify you and the Data Protection Board of India as required by the DPDP Act, and other regulators where their law applies.",
    ],
  },
  {
    id: "your-rights",
    heading: "Your rights",
    blocks: [
      "Subject to the law that applies to you, you can ask us to:",
      {
        list: [
          "Give you a copy of the personal data we hold about you, and tell you who we have shared it with.",
          "Correct data that is inaccurate, incomplete or out of date.",
          "Delete your data, subject to the retention rules above and to suppression records, which we will not delete because doing so would harm the people they protect.",
          "Restrict or object to certain processing, or withdraw a consent you previously gave.",
          "Give you your data in a portable, machine-readable form.",
          "Recognise a person you nominate to exercise these rights on your behalf in the event of your death or incapacity, as the DPDP Act provides.",
        ],
      },
      "Write to privacy@letterstack.site and we will respond within 30 days. If our answer does not satisfy you, you may complain to the Data Protection Board of India, or to your local supervisory authority if you are in the UK or EU.",
      "If your data reached us because a LetterStack customer uploaded it, we will pass your request to that customer, who controls the list. We will act on unsubscribe and suppression requests ourselves and immediately, without waiting for them.",
    ],
  },
  {
    id: "children",
    heading: "Children",
    blocks: [
      "LetterStack is a business tool and is not directed at children. We do not knowingly create accounts for anyone under 18, and we do not knowingly process children's personal data as a controller. If you believe a child has given us personal data, write to privacy@letterstack.site and we will delete it.",
      "If your mailing list includes people under 18, you are responsible for holding whatever verifiable parental consent the law requires before you send to them.",
    ],
  },
  {
    id: "cookies",
    heading: "Cookies",
    blocks: [
      "We use cookies for one thing: keeping you signed in. That means a session cookie and the security tokens that protect it against forgery. There are no advertising, profiling or third-party analytics cookies on the product, so there is nothing here you could opt out of without also being logged out.",
      "Emails sent through LetterStack may carry open and click tracking, which the sending organisation enables. Open tracking uses a tracking pixel and is an estimate rather than a fact: many mail clients block or pre-fetch images, which makes opens unreliable in both directions.",
    ],
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    blocks: [
      "We will update this policy as the product changes. If a change materially affects how we handle your personal data, we will email account holders before it takes effect. The date at the top always reflects the current version.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated={UPDATED}
      summary="We hold two very different kinds of data, and we treat them differently. Data about you as a customer is ours to look after. The mailing lists you upload are yours: we process them to send what you ask us to send, and for nothing else. We do not sell personal data, we run no advertising trackers, and where we connect to Gmail we ask for permission to send mail and nothing more."
      sections={SECTIONS}
    />
  );
}
