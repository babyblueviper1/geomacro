import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, ExternalLink, Github, LifeBuoy, Mail, Network, ShieldCheck } from "lucide-react";

const TITLE = "Contact Geomacro · Sales, Support, Integrations & Partnerships";
const DESCRIPTION =
  "Contact Geomacro for commercial access, customer support, institutional risk workflows, API integrations and strategic partnerships.";
const URL = "https://geomacro.live/contact";
const X_URL = "https://x.com/GeomacroLive";
const GITHUB_URL = "https://github.com/blocknine0/geomacro";
const EMAIL = "contact@geomacro.live";
const COMMERCIAL_EMAIL = `mailto:${EMAIL}?subject=${encodeURIComponent("Geomacro commercial access")}`;
const SUPPORT_EMAIL = `mailto:${EMAIL}?subject=${encodeURIComponent("Geomacro customer support")}`;
const INTEGRATION_EMAIL = `mailto:${EMAIL}?subject=${encodeURIComponent("Geomacro API / integration discussion")}`;
const PARTNERSHIP_EMAIL = `mailto:${EMAIL}?subject=${encodeURIComponent("Geomacro strategic partnership discussion")}`;

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://geomacro.live/og-image-v2.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Contact Geomacro",
          url: URL,
          description: DESCRIPTION,
          isPartOf: { "@type": "WebSite", name: "Geomacro", url: "https://geomacro.live/" },
        }),
      },
    ],
  }),
  component: ContactPage,
});

const contactPaths = [
  {
    icon: Briefcase,
    title: "Commercial access",
    text: "For institutions, operators or teams evaluating Geomacro Intelligence, Critical Minerals & Rare Earth Risk, Risk Indices, Ask Geomacro or governed machine delivery.",
    cta: "Discuss commercial access",
    href: COMMERCIAL_EMAIL,
  },
  {
    icon: LifeBuoy,
    title: "Customer support",
    text: "For product questions, access problems, unexpected output, website issues or anything the Geomacro Customer Care assistant could not resolve.",
    cta: "Contact customer support",
    href: SUPPORT_EMAIL,
  },
  {
    icon: Network,
    title: "API, agent or workflow integration",
    text: "Discuss governed data delivery, Risk Objects, Risk Gate or machine-readable integration for software, internal systems or AI-agent workflows.",
    cta: "Discuss an integration",
    href: INTEGRATION_EMAIL,
  },
  {
    icon: ShieldCheck,
    title: "Strategic or ecosystem partnership",
    text: "For distribution, data, infrastructure, accelerator, grant or strategic collaboration around Geomacro's risk-intelligence layer.",
    cta: "Discuss a partnership",
    href: PARTNERSHIP_EMAIL,
  },
] as const;

const COMMERCIAL_DETAILS = [
  "Your organization or team and the workflow owner.",
  "The geopolitical, macroeconomic, country, corridor or critical-minerals problem you want to evaluate.",
  "The decision point Geomacro should support: monitoring, review, approval, escalation, limit setting or another workflow.",
  "Whether you need human-facing intelligence, structured export, API, Risk Object or Risk Gate delivery.",
  "Expected usage, latency or integration requirements for machine access.",
  "What a successful commercial evaluation should demonstrate for your team.",
] as const;

function ContactPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <section className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Sales & Support</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Talk to Geomacro.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Use the Customer Care button for common product questions. For commercial access, customer support, integrations or partnerships, contact the Geomacro team directly.
        </p>
        <a href={`mailto:${EMAIL}`} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
          <Mail className="h-4 w-4" /> {EMAIL}
        </a>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        {contactPaths.map((section) => {
          const Icon = section.icon;
          return (
            <article key={section.title} className="flex min-h-[230px] flex-col rounded-2xl border border-border/70 bg-card/40 p-6 transition hover:border-primary/30">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon className="h-4 w-4 text-primary" /> {section.title}
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{section.text}</p>
              <a
                href={section.href}
                className="mt-5 inline-flex min-h-10 items-center gap-2 self-start rounded-md border border-border/70 px-3 py-2 text-sm transition hover:border-primary/40 hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5" /> {section.cta}
              </a>
            </article>
          );
        })}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-border/70 bg-card/40 p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">For a useful commercial conversation</p>
          <h2 className="mt-3 text-2xl font-semibold">Send the workflow, not just the industry.</h2>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {COMMERCIAL_DETAILS.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Do not email seed phrases, private keys, production secrets or unnecessary personal/confidential data. Sensitive data handling should be agreed before it is introduced.
          </p>
        </article>

        <article className="rounded-2xl border border-border/70 bg-card/40 p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Commercial path</p>
          <h2 className="mt-3 text-2xl font-semibold">Scope first. Delivery second.</h2>
          <ol className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <li><span className="font-mono text-primary">01</span> Confirm the workflow and current Geomacro coverage.</li>
            <li><span className="font-mono text-primary">02</span> Define the subject scope, evidence eligibility, delivery interface and success criteria.</li>
            <li><span className="font-mono text-primary">03</span> Agree commercial, support, security and data-handling terms for the required service level.</li>
          </ol>
        </article>
      </section>

      <section className="mt-10 flex flex-col justify-between gap-5 rounded-2xl border border-border/70 bg-card/30 p-5 sm:flex-row sm:items-center">
        <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Commercial boundary:</span> Geomacro sells risk intelligence and governed machine-delivery capabilities. Prediction Markets, Bridge and Swap remain separate testnet technical proofs and are not part of the commercial mainnet product.
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm hover:border-primary/40">
            <Github className="h-4 w-4" /> GitHub
          </a>
          <a href={X_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm hover:border-primary/40">
            <ExternalLink className="h-4 w-4" /> X
          </a>
        </div>
      </section>
    </main>
  );
}
