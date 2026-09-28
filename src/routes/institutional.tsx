import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Building2, CheckCircle2, Landmark, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TITLE = "Institutional Risk Intelligence | Geomacro";
const DESCRIPTION =
  "Commercial geopolitical, macroeconomic and critical-minerals risk intelligence for treasury, payments, strategy, supply-chain and software teams.";

const USE_CASES = [
  [Landmark, "Treasury & payments", "Review country and corridor risk before approvals, exposure changes, payment decisions or escalation."],
  [Building2, "Risk & strategy", "Track what changed, why it matters, evidence strength, confidence and the drivers behind risk movement."],
  [RouteIcon, "Supply chain & commodities", "Monitor geopolitical, macro and critical-minerals exposure relevant to sourcing, concentration and operational risk."],
  [Bot, "Software & AI agents", "Consume governed machine-readable risk context before the customer's own controls decide what happens next."],
] as const;

const DELIVERABLES = [
  "Live Intelligence across geopolitical, macroeconomic and critical-minerals domains",
  "Separate Geopolitical, Macroeconomic and Critical Minerals Risk Indices",
  "Dedicated Critical Minerals & Rare Earth Risk coverage",
  "Ask Geomacro for grounded evidence-backed questions",
  "Research, evidence and methodology for professional review",
  "Governed Data & API delivery for approved machine workflows",
] as const;

export const Route = createFileRoute("/institutional")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://geomacro.live/institutional" },
      { property: "og:image", content: "https://geomacro.live/og-signal-card-v2.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://geomacro.live/institutional" }],
  }),
  component: InstitutionalPage,
});

function InstitutionalPage() {
  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-20">
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-[0.14em]">COMMERCIAL RISK INTELLIGENCE</Badge>
          <h1 className="mt-5 max-w-5xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Explainable external-risk intelligence for real operational decisions.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Geomacro helps professional teams understand geopolitical, macroeconomic and critical-minerals risk with evidence, confidence and explicit product boundaries instead of an unsupported headline score.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2"><Link to="/contact">Discuss commercial access <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/intelligence">Open Intelligence</Link></Button>
            <Button asChild size="lg" variant="ghost"><Link to="/global-risk">Open Risk Indices</Link></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">What institutional users receive</p>
        <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">A reviewable risk product, not a black-box alert feed.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {DELIVERABLES.map((item) => (
            <div key={item} className="flex gap-3 rounded-xl border border-border/70 bg-card/40 p-5 text-sm leading-relaxed">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-card/20">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Applied workflows</p>
          <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">Different teams, one evidence trail.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {USE_CASES.map(([Icon, title, body]) => (
              <article key={title} className="rounded-2xl border border-border/70 bg-background/30 p-6">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-border/70 bg-card/40 p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">For people</p>
          <h2 className="mt-3 text-2xl font-semibold">Investigate, compare and explain risk.</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Analysts and operators can inspect current intelligence, supporting records, confidence, change drivers, separate Risk Indices and Critical Minerals & Rare Earth Risk without needing a wallet.
          </p>
          <Button asChild variant="outline" className="mt-5"><Link to="/intelligence">Explore human-facing product</Link></Button>
        </article>
        <article className="rounded-2xl border border-border/70 bg-card/40 p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">For machines</p>
          <h2 className="mt-3 text-2xl font-semibold">Use governed context inside software.</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Approved software and agent workflows can consume machine-readable risk delivery according to the live Data & API availability status. Geomacro supplies context; customer identity, policy and execution remain customer-controlled.
          </p>
          <Button asChild variant="outline" className="mt-5"><Link to="/data-api">Review machine delivery</Link></Button>
        </article>
      </section>

      <section className="border-y border-border/60 bg-card/20">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-7 sm:p-9">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Commercial boundary</p>
            <h2 className="mt-3 text-2xl font-semibold">Geomacro is a risk-intelligence product.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Prediction Markets, Bridge and Swap remain separate testnet technical proofs. They are not part of the institutional commercial mainnet product. Controlled machine capabilities are labelled according to their actual availability rather than being presented as generally available before they are ready.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-4xl border-t border-border/70 pt-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Work with Geomacro</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Bring a real risk-sensitive workflow.</h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Share the decision point, subject scope, delivery method and support expectations. Geomacro will state what is live, controlled or unsupported before a commercial commitment.
          </p>
          <Button asChild size="lg" className="mt-7 gap-2"><Link to="/contact">Contact Geomacro <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </section>
    </main>
  );
}
