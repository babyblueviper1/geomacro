import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";

const LAUNCH_PRODUCTS = [
  ["Risk Intelligence", "Current geopolitical, macroeconomic and critical-mineral developments with evidence, confidence and explainable risk context."],
  ["Critical Minerals & Rare Earth Risk", "Dedicated coverage of supply concentration, geopolitical dependency, sourcing pressure and related macro exposure."],
  ["Separate Risk Indices", "Geopolitical, Macroeconomic and Critical Minerals Risk Indices remain separate so users can see which domain is actually moving."],
  ["Ask Geomacro", "Grounded questions over Geomacro's recorded evidence and current risk context."],
] as const;

const USER_VALUE = [
  "See what changed and why it matters",
  "Inspect supporting evidence and confidence boundaries",
  "Compare separate geopolitical, macroeconomic and critical-minerals risk",
  "Investigate rare-earth and strategic-mineral exposure",
  "Ask grounded questions without relying on an unsupported AI answer",
] as const;

const ROADMAP = [
  "Governed machine/API delivery",
  "Signed Risk Objects and Risk Gate",
  "Paid agent and x402 production access",
  "Additional automated and institutional delivery workflows",
] as const;

const BUYERS = [
  ["Risk & strategy", "Monitor external risk changes with evidence and explicit confidence boundaries."],
  ["Treasury & operations", "Use country and macro context as an input to review and escalation workflows."],
  ["Supply chain & commodities", "Track critical-mineral, rare-earth and geopolitical exposure relevant to sourcing and concentration risk."],
  ["Research teams", "Move from scattered developments to structured, reviewable risk intelligence."],
] as const;

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-muted-foreground">{children}</p>;
}

export function CommercialHome() {
  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pb-24 lg:pt-24">
        <div className="max-w-5xl">
          <Label>Global risk intelligence</Label>
          <h1 className="mt-5 max-w-5xl text-[clamp(2.7rem,6vw,5.6rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
            Turn world events into <span className="text-primary">decision-ready</span> risk context.
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Geomacro converts geopolitical, macroeconomic and critical-mineral developments into explainable risk intelligence with evidence, confidence and clear change drivers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2"><Link to="/intelligence">Open Intelligence <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/global-risk">Explore Risk Indices</Link></Button>
            <Button asChild size="lg" variant="ghost"><Link to="/ask-geomacro">Ask Geomacro</Link></Button>
          </div>
        </div>
      </section>

      <section className="border-y border-primary/20 bg-primary/5">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <Label>Critical Minerals & Rare Earth Risk</Label>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A dedicated launch product for strategic mineral and rare-earth exposure.</h2>
          </div>
          <div>
            <p className="text-base leading-relaxed text-muted-foreground">Evaluate supply concentration, geopolitical dependency, sourcing pressure and related macro exposure with supporting intelligence and explicit confidence boundaries.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild><Link to="/global-risk">Open Critical Minerals Risk</Link></Button>
              <Button asChild variant="outline"><Link to="/intelligence">See supporting intelligence</Link></Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
        <div className="max-w-3xl">
          <Label>Available at launch</Label>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Only launch-ready products are presented as products.</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">Experimental, controlled or future capabilities are kept out of the launch promise and placed on the roadmap instead.</p>
        </div>
        <div className="mt-9 border-t border-border/70">
          {LAUNCH_PRODUCTS.map(([title, body]) => (
            <article key={title} className="grid gap-2 border-b border-border/60 py-5 md:grid-cols-[1fr_1.6fr] md:gap-8">
              <h3 className="text-base font-semibold"><span className="mr-3 text-xs text-primary">LIVE</span>{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-card/10">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <article>
            <Label>What users get</Label>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Evidence-driven intelligence they can inspect.</h2>
            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {USER_VALUE.map((item) => <li key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{item}</span></li>)}
            </ul>
          </article>
          <article className="rounded-2xl border border-border/70 bg-background/30 p-6 sm:p-8">
            <Label>Roadmap, not launch promise</Label>
            <h2 className="mt-3 text-2xl font-semibold">Machine and automation layers come after the launch surface.</h2>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {ROADMAP.map((item) => <li key={item} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" /><span>{item}</span></li>)}
            </ul>
            <Button asChild variant="outline" className="mt-6"><Link to="/roadmap">View roadmap</Link></Button>
          </article>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <Label>Who it is for</Label>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight">Built for teams that need explainable external-risk context.</h2>
        <div className="mt-9 grid gap-7 md:grid-cols-2 xl:grid-cols-4">
          {BUYERS.map(([title, body]) => <article key={title} className="border-t border-border/70 pt-5"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p></article>)}
        </div>
      </section>

      <section className="border-y border-border/60 bg-card/10">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground"><Handshake className="h-4 w-4" /><Label>Commercial access</Label></div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Bring a real risk workflow.</h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">For institutional evaluations, research workflows, partnerships and support, contact Geomacro. We will describe exactly what is available today and keep roadmap capabilities separate.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Button asChild size="lg" className="gap-2"><Link to="/contact">Contact Geomacro <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/institutional">Institutional use cases</Link></Button>
          </div>
        </div>
      </section>
    </>
  );
}
