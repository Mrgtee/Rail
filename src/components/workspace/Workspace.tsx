import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  LockKeyhole,
  PauseCircle,
  Play,
  WalletCards,
  Zap,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import { activationSteps, draftingSteps, simulateAgentActivity } from "../../domain/mockRail";
import type { ActivityEvent, AppStage, PolicyDraft, WalletState } from "../../domain/types";
import {
  ActivityCard,
  Metric,
  MiniProof,
  PolicyField,
  RailButton,
  ScreenFrame,
  StatusPill,
  WardenPanel,
} from "../shared/RailUi";

const chips = ["DCA weekly", "Keep reserve", "Set slippage limit", "Stop after date"];

const policyFields: Array<{
  key: keyof Pick<
    PolicyDraft,
    | "strategy"
    | "spendPerExecution"
    | "frequency"
    | "monthlyCap"
    | "allowedAssets"
    | "slippageLimit"
    | "minimumReserve"
    | "expiry"
    | "agentPermission"
  >;
  label: string;
}> = [
  { key: "strategy", label: "Strategy" },
  { key: "spendPerExecution", label: "Spend" },
  { key: "frequency", label: "Frequency" },
  { key: "monthlyCap", label: "Monthly cap" },
  { key: "allowedAssets", label: "Allowed assets" },
  { key: "slippageLimit", label: "Slippage limit" },
  { key: "minimumReserve", label: "Minimum reserve" },
  { key: "expiry", label: "Expiry" },
  { key: "agentPermission", label: "Agent permission" },
];

interface ProductWorkspaceProps {
  activity: ActivityEvent[];
  activationStep: number;
  draftingStep: number;
  goal: string;
  onConnect: () => void;
  onGeneratePolicy: () => void;
  onGoalChange: (goal: string) => void;
  onLaunch: () => void;
  onPause: () => void;
  onReset: () => void;
  onSign: () => void;
  policy: PolicyDraft;
  stage: AppStage;
  wallet: WalletState;
}

export function ProductWorkspace({
  activity,
  activationStep,
  draftingStep,
  goal,
  onConnect,
  onGeneratePolicy,
  onGoalChange,
  onLaunch,
  onPause,
  onReset,
  onSign,
  policy,
  stage,
  wallet,
}: ProductWorkspaceProps) {
  return (
    <div className="rounded-lg border border-rail-border bg-rail-graphite shadow-glow">
      <div className="flex flex-col justify-between gap-4 border-b border-rail-border p-5 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rail-muted">Interactive MVP</p>
          <h2 className="mt-2 text-2xl font-semibold text-rail-text">Policy automation workspace</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label="Robinhood Chain Testnet" tone="blue" />
          <StatusPill label="Testnet only" tone="amber" />
          {wallet === "connected" ? <StatusPill label="Wallet connected" tone="green" /> : null}
        </div>
      </div>
      <div className="grid min-h-[720px] lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-rail-border p-5 lg:border-b-0 lg:border-r">
          <StageRail current={stage} />
        </aside>
        <div className="p-5 sm:p-8">
          <AnimatePresence mode="wait">
            {stage === "landing" ? <WelcomePanel key="welcome" onLaunch={onLaunch} /> : null}
            {stage === "connect" ? <ConnectScreen key="connect" onConnect={onConnect} wallet={wallet} /> : null}
            {stage === "goal" ? (
              <GoalScreen key="goal" goal={goal} onGeneratePolicy={onGeneratePolicy} onGoalChange={onGoalChange} />
            ) : null}
            {stage === "drafting" ? <DraftingScreen key="drafting" activeStep={draftingStep} /> : null}
            {stage === "review" ? <PolicyReviewScreen key="review" onSign={onSign} policy={policy} /> : null}
            {stage === "activating" ? <ActivationScreen key="activating" activeStep={activationStep} /> : null}
            {stage === "dashboard" ? (
              <DashboardScreen key="dashboard" activity={activity} onPause={onPause} onReset={onReset} policy={policy} />
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface WelcomePanelProps {
  onLaunch: () => void;
}

function WelcomePanel({ onLaunch }: WelcomePanelProps) {
  return (
    <ScreenFrame eyebrow="Ready when you are" title="Create policy, sign rules, let the contract block unsafe moves.">
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <MiniProof label="AI proposes" value="Policy draft" />
        <MiniProof label="Agents execute" value="Inside limits" />
        <MiniProof label="Policy decides" value="Onchain check" />
      </div>
      <RailButton className="mt-8" icon={<ArrowRight size={17} />} onClick={onLaunch} size="lg">
        Start demo
      </RailButton>
    </ScreenFrame>
  );
}

interface ConnectScreenProps {
  onConnect: () => void;
  wallet: WalletState;
}

function ConnectScreen({ onConnect, wallet }: ConnectScreenProps) {
  return (
    <ScreenFrame eyebrow="Step 1" title="Connect your wallet to create an automation policy.">
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="rounded-lg border border-rail-border bg-rail-panel p-6">
          <div className="grid h-14 w-14 place-items-center rounded-lg border border-rail-border bg-rail-graphite text-rail-green">
            <WalletCards size={24} />
          </div>
          <p className="mt-6 text-lg leading-8 text-rail-secondary">
            Your funds stay controlled by smart contract rules. This demo simulates wallet connection and testnet policy activation.
          </p>
          <RailButton
            className="mt-7"
            disabled={wallet === "connecting"}
            icon={wallet === "connecting" ? <Clock3 size={17} /> : <WalletCards size={17} />}
            onClick={onConnect}
            size="lg"
          >
            {wallet === "connecting" ? "Connecting..." : "Connect Wallet"}
          </RailButton>
        </div>
        <WardenPanel state="monitoring" />
      </div>
    </ScreenFrame>
  );
}

interface GoalScreenProps {
  goal: string;
  onGeneratePolicy: () => void;
  onGoalChange: (goal: string) => void;
}

function GoalScreen({ goal, onGeneratePolicy, onGoalChange }: GoalScreenProps) {
  return (
    <ScreenFrame eyebrow="Step 2" title="Tell Rail the job. The next screen turns it into enforceable rails.">
      <div className="mt-8 rounded-lg border border-rail-border bg-rail-panel p-5">
        <label className="text-sm font-semibold text-rail-secondary" htmlFor="goal">
          Goal
        </label>
        <textarea
          className="mt-3 min-h-44 w-full resize-none rounded-lg border border-rail-border bg-rail-black p-5 text-lg leading-8 text-rail-text outline-none transition focus:border-rail-green"
          id="goal"
          onChange={(event) => onGoalChange(event.target.value)}
          value={goal}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              className="rounded-full border border-rail-border px-3 py-2 text-sm text-rail-secondary transition hover:border-rail-blue hover:text-rail-text"
              key={chip}
              onClick={() => onGoalChange(`${goal} ${chip}.`.trim())}
              type="button"
            >
              {chip}
            </button>
          ))}
        </div>
        <RailButton className="mt-6" icon={<Zap size={17} />} onClick={onGeneratePolicy} size="lg">
          Generate Policy
        </RailButton>
      </div>
    </ScreenFrame>
  );
}

interface DraftingScreenProps {
  activeStep: number;
}

function DraftingScreen({ activeStep }: DraftingScreenProps) {
  return (
    <ScreenFrame eyebrow="AI draft" title="Rail is translating intent into limits.">
      <div className="mt-8 grid gap-4">
        {draftingSteps.map((step, index) => {
          const isDone = index < activeStep;
          const isActive = index === activeStep;

          return (
            <div
              className={`flex items-center gap-4 rounded-lg border p-5 transition ${
                isActive
                  ? "border-rail-blue bg-rail-blue/10 text-rail-text"
                  : isDone
                    ? "border-rail-green/35 bg-rail-green/10 text-rail-text"
                    : "border-rail-border bg-rail-panel text-rail-muted"
              }`}
              key={step}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full border border-current">
                {isDone ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}
              </span>
              <span className="font-semibold">{step}</span>
            </div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}

interface PolicyReviewScreenProps {
  onSign: () => void;
  policy: PolicyDraft;
}

function PolicyReviewScreen({ onSign, policy }: PolicyReviewScreenProps) {
  return (
    <ScreenFrame eyebrow="Step 3" title="Review the policy before signing.">
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="rounded-lg border border-rail-border bg-rail-panel p-5">
          <div className="flex flex-col justify-between gap-3 border-b border-rail-border pb-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-rail-secondary">Policy Summary</p>
              <h3 className="mt-1 text-2xl font-semibold text-rail-text">Weekly DCA guardrails</h3>
            </div>
            <StatusPill label="Awaiting signature" tone="amber" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {policyFields.map((field) => (
              <PolicyField key={field.key} label={field.label} value={policy[field.key]} />
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-rail-green/30 bg-rail-green/10 p-4 text-sm font-semibold text-rail-green">
            The agent cannot execute outside these limits.
          </div>
        </div>
        <div className="rounded-lg border border-rail-border bg-rail-black p-5">
          <WardenPanel state="review" />
          <div className="mt-5 grid gap-3">
            <RailButton icon={<FileCheck2 size={17} />} onClick={onSign} size="lg">
              Sign Policy
            </RailButton>
            <button
              className="min-h-12 rounded-lg border border-rail-border px-5 text-sm font-semibold text-rail-secondary transition hover:border-rail-blue hover:text-rail-text"
              type="button"
            >
              Edit Rules
            </button>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

interface ActivationScreenProps {
  activeStep: number;
}

function ActivationScreen({ activeStep }: ActivationScreenProps) {
  return (
    <ScreenFrame eyebrow="Onchain activation" title="Creating the policy and confirming enforcement.">
      <div className="mt-8 grid gap-4">
        {activationSteps.map((step, index) => {
          const isDone = index < activeStep;
          const isActive = index === activeStep;

          return (
            <div
              className={`grid gap-2 rounded-lg border p-5 transition sm:grid-cols-[220px_1fr] ${
                isActive
                  ? "border-rail-blue bg-rail-blue/10"
                  : isDone
                    ? "border-rail-green/35 bg-rail-green/10"
                    : "border-rail-border bg-rail-panel"
              }`}
              key={step.key}
            >
              <div className="flex items-center gap-3 font-semibold text-rail-text">
                {isDone ? <CheckCircle2 className="text-rail-green" size={18} /> : <Clock3 className="text-rail-blue" size={18} />}
                {step.label}
              </div>
              <p className="text-rail-secondary">{step.detail}</p>
            </div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}

interface DashboardScreenProps {
  activity: ActivityEvent[];
  onPause: () => void;
  onReset: () => void;
  policy: PolicyDraft;
}

function DashboardScreen({ activity, onPause, onReset, policy }: DashboardScreenProps) {
  const events = useMemo(() => (activity.length > 0 ? activity : simulateAgentActivity()), [activity]);

  return (
    <ScreenFrame eyebrow="Dashboard" title="Your automation is live inside approved rails.">
      <div className="relative mt-8 overflow-hidden rounded-lg border border-rail-border bg-rail-black">
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          src="/dashboard-background.jpg"
        />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(8,10,13,0.96),rgba(8,10,13,0.76)_52%,rgba(8,10,13,0.92)),radial-gradient(circle_at_76%_18%,rgba(53,229,140,0.16),transparent_34%)]" />
        <div className="relative grid gap-5 p-4 sm:p-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Metric icon={<Gauge size={18} />} label="Vault balance" value="142.80 USDC" />
              <Metric icon={<Play size={18} />} label="Next action" value="Friday 09:00" />
            </div>
            <div className="rounded-lg border border-rail-border bg-rail-panel/90 p-5 backdrop-blur">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-rail-secondary">Active Policy</p>
                  <h3 className="mt-1 text-2xl font-semibold text-rail-text">Weekly DCA</h3>
                </div>
                <StatusPill label={policy.status === "paused" ? "Paused" : "Active"} tone={policy.status === "paused" ? "amber" : "green"} />
              </div>
              <div className="grid gap-3">
                <PolicyField label="Spend" value={policy.spendPerExecution} />
                <PolicyField label="Allowed assets" value={policy.allowedAssets} />
                <PolicyField label="Slippage limit" value={policy.slippageLimit} />
                <PolicyField label="Minimum reserve" value={policy.minimumReserve} />
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rail-border px-4 text-sm font-semibold text-rail-secondary transition hover:border-rail-amber hover:text-rail-text"
                  onClick={onPause}
                  type="button"
                >
                  <PauseCircle size={17} />
                  Pause Automation
                </button>
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rail-border px-4 text-sm font-semibold text-rail-secondary transition hover:border-rail-red hover:text-rail-text"
                  onClick={onReset}
                  type="button"
                >
                  <LockKeyhole size={17} />
                  Revoke Policy
                </button>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-rail-border bg-rail-black/90 p-5 backdrop-blur">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-rail-secondary">Activity Feed</p>
                <h3 className="mt-1 text-2xl font-semibold text-rail-text">Contract decisions</h3>
              </div>
              <StatusPill label="Live" tone="blue" />
            </div>
            <div className="grid gap-4">
              {events.map((event, index) => (
                <ActivityCard event={event} featured={index === 0} key={event.id} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

interface StageRailProps {
  current: AppStage;
}

function StageRail({ current }: StageRailProps) {
  const stages: Array<{ key: AppStage; label: string }> = [
    { key: "connect", label: "Connect" },
    { key: "goal", label: "Goal" },
    { key: "drafting", label: "Draft" },
    { key: "review", label: "Review" },
    { key: "activating", label: "Activate" },
    { key: "dashboard", label: "Dashboard" },
  ];
  const currentIndex = stages.findIndex((stage) => stage.key === current);

  return (
    <ol className="grid gap-3">
      {stages.map((stage, index) => {
        const isCurrent = stage.key === current;
        const isComplete = currentIndex > index;

        return (
          <li
            className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-sm transition ${
              isCurrent
                ? "border-rail-blue bg-rail-blue/10 text-rail-text"
                : isComplete
                  ? "border-rail-green/35 bg-rail-green/10 text-rail-green"
                  : "border-rail-border bg-rail-black text-rail-muted"
            }`}
            key={stage.key}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full border border-current text-xs font-semibold">
              {isComplete ? <CheckCircle2 size={14} /> : index + 1}
            </span>
            {stage.label}
          </li>
        );
      })}
    </ol>
  );
}
