import { BadgeCheck, Ban, CheckCircle2, Clock3 } from "lucide-react";
import { motion } from "framer-motion";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export const entrance = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export type StatusTone = "green" | "blue" | "amber" | "red";

interface StatusPillProps {
  label: string;
  tone: StatusTone;
}

export function StatusPill({ label, tone }: StatusPillProps) {
  const styles: Record<StatusTone, string> = {
    green: "border-rail-green/35 bg-rail-green/10 text-rail-green",
    blue: "border-rail-blue/35 bg-rail-blue/10 text-rail-blue",
    amber: "border-rail-amber/35 bg-rail-amber/10 text-rail-amber",
    red: "border-rail-red/35 bg-rail-red/10 text-rail-red",
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles[tone]}`}>{label}</span>;
}

interface RailButtonProps extends ComponentPropsWithoutRef<"button"> {
  icon?: ReactNode;
  size?: "md" | "lg";
}

export function RailButton({ children, className = "", icon, size = "md", ...props }: RailButtonProps) {
  const sizeClass = size === "lg" ? "min-h-12 px-6 text-base" : "min-h-10 px-4 text-sm";

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-rail-green font-semibold text-rail-black transition hover:-translate-y-0.5 hover:bg-[#66f0aa] focus:outline-none focus:ring-2 focus:ring-rail-green focus:ring-offset-2 focus:ring-offset-rail-black disabled:cursor-wait disabled:opacity-70 ${sizeClass} ${className}`}
      type="button"
      {...props}
    >
      <span>{children}</span>
      {icon}
    </button>
  );
}

interface ScreenFrameProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
}

export function ScreenFrame({ children, eyebrow, title }: ScreenFrameProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[620px]"
      exit={{ opacity: 0, y: -14 }}
      initial={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rail-green">{eyebrow}</p>
      <h2 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight text-rail-text sm:text-5xl">{title}</h2>
      {children}
    </motion.div>
  );
}

interface ProofLineProps {
  label: string;
  value: string;
}

export function ProofLine({ label, value }: ProofLineProps) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-rail-muted">{label}</p>
      <p className="mt-1 font-mono text-sm text-rail-text">{value}</p>
    </div>
  );
}

interface PolicyFieldProps {
  label: string;
  value: string;
}

export function PolicyField({ label, value }: PolicyFieldProps) {
  return (
    <div className="rounded-lg border border-rail-border bg-rail-black px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-rail-muted">{label}</p>
      <p className="mt-2 font-semibold text-rail-text">{value}</p>
    </div>
  );
}

interface MiniProofProps {
  label: string;
  value: string;
}

export function MiniProof({ label, value }: MiniProofProps) {
  return (
    <div className="rounded-lg border border-rail-border bg-rail-panel p-5">
      <p className="text-sm text-rail-secondary">{label}</p>
      <p className="mt-2 text-xl font-semibold text-rail-text">{value}</p>
    </div>
  );
}

interface MetricProps {
  icon: ReactNode;
  label: string;
  value: string;
}

export function Metric({ icon, label, value }: MetricProps) {
  return (
    <div className="rounded-lg border border-rail-border bg-rail-panel p-5">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-rail-border bg-rail-black text-rail-green">
        {icon}
      </div>
      <p className="text-sm text-rail-secondary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-rail-text">{value}</p>
    </div>
  );
}

export interface ActivityCardEvent {
  id?: string;
  kind: "executed" | "blocked" | "pending" | "review-needed" | "failed";
  title: string;
  attempted: string;
  reason: string;
  rule: string;
  fundsMoved: string;
  timestamp: string;
  txHash?: string;
}

interface ActivityCardProps {
  event: ActivityCardEvent;
  featured?: boolean;
  onClick?: () => void;
}

export function ActivityCard({ event, featured = false, onClick }: ActivityCardProps) {
  const isBlocked = event.kind === "blocked";
  const isExecuted = event.kind === "executed";
  const tone = isBlocked
    ? "border-rail-red/45 bg-rail-red/10"
    : isExecuted
      ? "border-rail-green/35 bg-rail-green/10"
      : "border-rail-amber/35 bg-rail-amber/10";

  return (
    <motion.article
      whileHover={{ y: featured ? -3 : -2 }}
      className={`rounded-lg border p-5 ${tone} ${onClick ? "cursor-pointer" : ""} ${featured ? "shadow-[0_0_60px_rgba(255,90,102,0.14)]" : ""}`}
      onClick={onClick}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`grid h-9 w-9 place-items-center rounded-full border ${
                isBlocked
                  ? "border-rail-red text-rail-red"
                  : isExecuted
                    ? "border-rail-green text-rail-green"
                    : "border-rail-amber text-rail-amber"
              }`}
            >
              {isBlocked ? <Ban size={17} /> : isExecuted ? <BadgeCheck size={17} /> : <Clock3 size={17} />}
            </span>
            <h3 className={`${featured ? "text-2xl" : "text-lg"} font-semibold text-rail-text`}>{event.title}</h3>
          </div>
          <p className="text-sm leading-6 text-rail-secondary">{event.reason}</p>
        </div>
        <span className="font-mono text-xs text-rail-muted">{event.timestamp}</span>
      </div>
      <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <ProofLine label="Attempted" value={event.attempted} />
        <ProofLine label="Rule" value={event.rule} />
        <ProofLine label="Funds moved" value={event.fundsMoved} />
        <ProofLine label={event.txHash ? "Transaction" : "Proof"} value={event.txHash ?? "Rejected before execution"} />
      </div>
    </motion.article>
  );
}

interface WardenPanelProps {
  state: "monitoring" | "review";
}

export function WardenPanel({ state }: WardenPanelProps) {
  return (
    <div className="rounded-lg border border-rail-border bg-rail-black p-6">
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-rail-border bg-rail-panel">
          <img
            alt="Warden, Rail safety guardian"
            className="h-full w-full object-cover"
            src="/warden.png"
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-rail-green">Warden</p>
          <p className="mt-2 leading-7 text-rail-secondary">
            {state === "review"
              ? "These are the rails your agent must follow."
              : "I am here to make sure your agent obeys your limits."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LogoLockup() {
  return (
    <a className="flex items-center gap-3" href="#" aria-label="Rail home">
      <span className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
        <img className="h-8 w-8 object-contain" src="/rail.png" alt="" />
      </span>
      <span className="leading-none">
        <span className="block text-lg font-semibold tracking-[0.02em] text-rail-text">Rail</span>
        <span className="block text-xs text-rail-muted">Agentic guardrails</span>
      </span>
    </a>
  );
}
