import {
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { ReactNode } from "react";
import { ActivityCard, entrance, LogoLockup, ProofLine, RailButton } from "../shared/RailUi";

interface HeaderProps {
  onLaunch: () => void;
}

export function Header({ onLaunch }: HeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-rail-black/76 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <LogoLockup />
        <nav aria-label="Primary navigation" className="hidden items-center gap-8 text-sm text-rail-secondary md:flex">
          <a className="transition hover:text-rail-text" href="#how">
            How it works
          </a>
          <a className="transition hover:text-rail-text" href="#blocked">
            Blocked actions
          </a>
          <a className="transition hover:text-rail-text" href="#app">
            Demo
          </a>
        </nav>
        <RailButton icon={<ArrowRight size={16} />} onClick={onLaunch}>
          Launch App
        </RailButton>
      </div>
    </header>
  );
}

interface HeroProps {
  onLaunch: () => void;
}

export function Hero({ onLaunch }: HeroProps) {
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden border-b border-rail-border px-4 pb-16 pt-28 sm:px-6 lg:px-8">
      <div className="rail-grid absolute inset-0 -z-20" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_34%,rgba(53,229,140,0.13),transparent_32%),linear-gradient(115deg,rgba(8,10,13,0.98)_0%,rgba(8,10,13,0.9)_42%,rgba(17,21,27,0.78)_100%)]" />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[0.86fr_1.14fr]">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.11 } },
          }}
          className="max-w-2xl"
        >
          <motion.p variants={entrance} className="mb-5 text-sm font-medium uppercase tracking-[0.22em] text-rail-green">
            Autonomous finance, kept on track
          </motion.p>
          <motion.h1 variants={entrance} className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-normal text-rail-text sm:text-6xl lg:text-7xl">
            Put your onchain investing on autopilot without giving up control.
          </motion.h1>
          <motion.p variants={entrance} className="mt-7 max-w-xl text-lg leading-8 text-rail-secondary">
            Rail turns plain-English goals into smart contract policies that AI agents must obey before moving funds.
          </motion.p>
          <motion.div variants={entrance} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <RailButton icon={<ArrowRight size={17} />} onClick={onLaunch} size="lg">
              Create a Policy
            </RailButton>
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rail-border px-5 text-sm font-semibold text-rail-text transition hover:border-rail-blue hover:text-white"
              href="#blocked"
            >
              View Demo
              <ChevronRight size={16} />
            </a>
          </motion.div>
        </motion.div>
        <RailRouteVisual />
      </div>
    </section>
  );
}

function RailRouteVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.72, ease: "easeOut" }}
      className="relative min-h-[520px] overflow-hidden rounded-lg border border-white/10 bg-rail-graphite/72 p-4 shadow-glow backdrop-blur"
      aria-label="Goal to policy to contract enforcement flow"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(91,140,255,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]" />
      <div className="relative flex h-full min-h-[488px] flex-col justify-between">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <FlowCheck label="Goal" state="approved" />
          <FlowCheck label="Policy" state="approved" />
          <FlowCheck label="Agent" state="active" />
          <FlowCheck label="Contract" state="blocked" />
        </div>
        <div className="relative my-8 flex min-h-[250px] items-center justify-center">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 760 300" fill="none" role="img" aria-label="Agent route constrained by rails">
            <path d="M48 158 C180 54 293 69 378 146 C468 228 565 244 711 124" stroke="#26303B" strokeWidth="34" strokeLinecap="round" />
            <path d="M48 158 C180 54 293 69 378 146 C468 228 565 244 711 124" stroke="#35E58C" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 12" />
            <path d="M54 198 C194 94 294 108 354 178 C410 244 508 271 674 178" stroke="#26303B" strokeWidth="20" strokeLinecap="round" />
            <path d="M54 198 C194 94 294 108 354 178 C410 244 508 271 674 178" stroke="#5B8CFF" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 12" />
            <path d="M568 76 L635 191" stroke="#FF5A66" strokeWidth="8" strokeLinecap="round" />
            <circle cx="376" cy="146" r="10" fill="#35E58C" />
            <circle cx="570" cy="216" r="10" fill="#5B8CFF" />
          </svg>
          <div className="relative grid w-full grid-cols-1 gap-4 md:grid-cols-[1fr_0.9fr]">
            <VisualPanel title="User goal" tone="blue">
              DCA 20 USDC into ETH every week. Keep 50 USDC liquid. Stop above 1% slippage.
            </VisualPanel>
            <VisualPanel title="Contract check" tone="red">
              Blocked: route quote exceeded signed slippage limit. Funds moved: 0 USDC.
            </VisualPanel>
          </div>
        </div>
        <div className="grid gap-3 border-t border-white/10 pt-4 text-sm md:grid-cols-3">
          <ProofLine label="PolicyVault" value="0x7a91...B04f" />
          <ProofLine label="Agent permission" value="Execute only" />
          <ProofLine label="Final authority" value="Smart contract" />
        </div>
      </div>
    </motion.div>
  );
}

interface FlowCheckProps {
  label: string;
  state: "approved" | "active" | "blocked";
}

function FlowCheck({ label, state }: FlowCheckProps) {
  const styles = {
    approved: "border-rail-green/30 bg-rail-green/10 text-rail-green",
    active: "border-rail-blue/30 bg-rail-blue/10 text-rail-blue",
    blocked: "border-rail-red/35 bg-rail-red/10 text-rail-red",
  };

  return (
    <div className={`rounded-lg border px-3 py-3 ${styles[state]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{label}</span>
        {state === "blocked" ? <Ban size={15} /> : <CheckCircle2 size={15} />}
      </div>
    </div>
  );
}

interface VisualPanelProps {
  children: ReactNode;
  title: string;
  tone: "blue" | "red";
}

function VisualPanel({ children, title, tone }: VisualPanelProps) {
  const toneClass =
    tone === "blue"
      ? "border-rail-blue/30 bg-rail-blue/10 shadow-blue-glow"
      : "border-rail-red/35 bg-rail-red/10";

  return (
    <div className={`rounded-lg border p-5 backdrop-blur ${toneClass}`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-rail-secondary">{title}</p>
      <p className="text-base leading-7 text-rail-text">{children}</p>
    </div>
  );
}

interface LandingStoryProps {
  onLaunch: () => void;
}

export function LandingStory({ onLaunch }: LandingStoryProps) {
  const { scrollYProgress } = useScroll();
  const railShift = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);

  return (
    <>
      <section id="how" className="relative border-b border-rail-border px-4 py-24 sm:px-6 lg:px-8">
        <motion.div style={{ x: railShift }} className="pointer-events-none absolute left-0 top-10 h-px w-[140vw] bg-gradient-to-r from-transparent via-rail-green/40 to-transparent" />
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.75fr_1.25fr]">
          <SectionKicker label="The control layer" title="AI agents are useful. Unrestricted wallet access is not." />
          <div className="grid gap-4 md:grid-cols-3">
            <StepBlock icon={<FileCheck2 size={20} />} title="Describe your goal">
              Turn an investing instruction into explicit limits.
            </StepBlock>
            <StepBlock icon={<SlidersHorizontal size={20} />} title="Approve your rails">
              Review spend, assets, slippage, reserve, and expiry.
            </StepBlock>
            <StepBlock icon={<ShieldCheck size={20} />} title="Let it execute safely">
              Every action has to pass the contract first.
            </StepBlock>
          </div>
        </div>
      </section>
      <section id="blocked" className="relative border-b border-rail-border bg-rail-graphite/45 px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_0.88fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-rail-red">Demo moment</p>
            <h2 className="max-w-2xl text-4xl font-semibold leading-tight text-rail-text sm:text-5xl">
              The safest action is sometimes the one that never happens.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-rail-secondary">
              The agent can move fast, but only inside rules the user approved. When a route crosses a limit, Rail shows exactly why it stopped.
            </p>
          </div>
          <ActivityCard
            event={{
              id: "landing-blocked",
              kind: "blocked",
              title: "Blocked: slippage above 1%",
              attempted: "Swap 20 USDC -> ETH at 1.7% slippage",
              reason: "Quoted route exceeded your signed slippage limit.",
              rule: "Max slippage per execution",
              fundsMoved: "0 USDC",
              timestamp: "Just now",
            }}
            featured
          />
        </div>
      </section>
      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 border-y border-rail-border py-14 md:flex-row md:items-center">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-rail-green">Rail</p>
            <h2 className="max-w-3xl text-4xl font-semibold leading-tight text-rail-text sm:text-5xl">
              Give your agent a job. Not your whole wallet.
            </h2>
          </div>
          <RailButton icon={<ArrowRight size={17} />} onClick={onLaunch} size="lg">
            Launch App
          </RailButton>
        </div>
      </section>
    </>
  );
}

interface SectionKickerProps {
  label: string;
  title: string;
}

function SectionKicker({ label, title }: SectionKickerProps) {
  return (
    <div>
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-rail-green">{label}</p>
      <h2 className="max-w-2xl text-4xl font-semibold leading-tight text-rail-text sm:text-5xl">{title}</h2>
    </div>
  );
}

interface StepBlockProps {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}

function StepBlock({ children, icon, title }: StepBlockProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-lg border border-rail-border bg-rail-graphite p-6 transition-colors hover:border-rail-green/45"
    >
      <div className="mb-6 grid h-11 w-11 place-items-center rounded-lg border border-rail-border bg-rail-panel text-rail-green">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-rail-text">{title}</h3>
      <p className="mt-3 leading-7 text-rail-secondary">{children}</p>
    </motion.div>
  );
}
