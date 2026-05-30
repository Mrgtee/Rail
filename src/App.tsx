import {
  ArrowRight,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Gauge,
  LockKeyhole,
  PauseCircle,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import {
  activatePolicy,
  activationSteps,
  defaultGoal,
  draftingSteps,
  generatePolicy,
  samplePolicy,
  signPolicy,
  simulateAgentActivity,
} from "./mockRail";
import type { ActivityEvent, AppStage, PolicyDraft, WalletState } from "./types";

const entrance = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

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

function App() {
  const appRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<AppStage>("landing");
  const [wallet, setWallet] = useState<WalletState>("disconnected");
  const [goal, setGoal] = useState(defaultGoal);
  const [policy, setPolicy] = useState<PolicyDraft | null>(null);
  const [draftingStep, setDraftingStep] = useState(0);
  const [activationStep, setActivationStep] = useState(0);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const activePolicy = policy ?? samplePolicy;

  const moveToApp = (nextStage: AppStage) => {
    startTransition(() => {
      setStage(nextStage);
    });

    window.setTimeout(() => {
      appRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const handleConnectWallet = () => {
    setWallet("connecting");

    window.setTimeout(() => {
      setWallet("connected");
      moveToApp("goal");
    }, 650);
  };

  const handleGeneratePolicy = () => {
    setDraftingStep(0);
    moveToApp("drafting");
  };

  const handleSignPolicy = () => {
    if (!policy) {
      return;
    }

    setActivationStep(0);
    moveToApp("activating");
  };

  useEffect(() => {
    if (stage !== "drafting") {
      return;
    }

    const timers = draftingSteps.map((_, index) =>
      window.setTimeout(() => {
        setDraftingStep(index);
      }, index * 430),
    );

    const finishTimer = window.setTimeout(() => {
      void generatePolicy(goal).then((draft) => {
        setPolicy(draft);
        moveToApp("review");
      });
    }, draftingSteps.length * 430 + 420);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(finishTimer);
    };
  }, [goal, stage]);

  useEffect(() => {
    if (stage !== "activating") {
      return;
    }

    const timers = activationSteps.map((_, index) =>
      window.setTimeout(() => {
        setActivationStep(index);
      }, index * 560),
    );

    const finishTimer = window.setTimeout(() => {
      void signPolicy(activePolicy)
        .then(activatePolicy)
        .then((activatedPolicy) => {
          setPolicy(activatedPolicy);
          setActivity(simulateAgentActivity());
          moveToApp("dashboard");
        });
    }, activationSteps.length * 560 + 450);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(finishTimer);
    };
  }, [activePolicy, stage]);

  return (
    <div className="min-h-screen overflow-hidden bg-rail-black text-rail-text">
      <Header onLaunch={() => moveToApp(stage === "landing" ? "connect" : stage)} />
      <main>
        <Hero onLaunch={() => moveToApp("connect")} />
        <LandingStory onLaunch={() => moveToApp("connect")} />
        <section
          ref={appRef}
          id="app"
          className="relative border-t border-rail-border bg-rail-black px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <ProductWorkspace
              activity={activity}
              activationStep={activationStep}
              draftingStep={draftingStep}
              goal={goal}
              onConnect={handleConnectWallet}
              onGeneratePolicy={handleGeneratePolicy}
              onGoalChange={setGoal}
              onLaunch={() => moveToApp("connect")}
              onPause={() => setPolicy({ ...activePolicy, status: "paused" })}
              onReset={() => {
                setWallet("disconnected");
                setPolicy(null);
                setActivity([]);
                setGoal(defaultGoal);
                moveToApp("connect");
              }}
              onSign={handleSignPolicy}
              policy={activePolicy}
              stage={stage}
              wallet={wallet}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

interface HeaderProps {
  onLaunch: () => void;
}

function Header({ onLaunch }: HeaderProps) {
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

function LogoLockup() {
  return (
    <a className="flex items-center gap-3" href="#" aria-label="Rail home">
      <span className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
        <img className="h-8 w-8 object-contain" src="/rail.png" alt="" />
      </span>
      <span className="leading-none">
        <span className="block text-lg font-semibold tracking-[0.02em] text-rail-text">Rail</span>
        <span className="block text-xs text-rail-muted">by GuardRail Finance</span>
      </span>
    </a>
  );
}

interface HeroProps {
  onLaunch: () => void;
}

function Hero({ onLaunch }: HeroProps) {
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
          <motion.div variants={entrance} className="mb-8">
            <LogoLockup />
          </motion.div>
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

interface ProofLineProps {
  label: string;
  value: string;
}

function ProofLine({ label, value }: ProofLineProps) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-rail-muted">{label}</p>
      <p className="mt-1 font-mono text-sm text-rail-text">{value}</p>
    </div>
  );
}

interface LandingStoryProps {
  onLaunch: () => void;
}

function LandingStory({ onLaunch }: LandingStoryProps) {
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

function ProductWorkspace({
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
          <StatusPill label="Base Sepolia" tone="blue" />
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
      <div className="mt-8 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Metric icon={<Gauge size={18} />} label="Vault balance" value="142.80 USDC" />
            <Metric icon={<Play size={18} />} label="Next action" value="Friday 09:00" />
          </div>
          <div className="rounded-lg border border-rail-border bg-rail-panel p-5">
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
        <div className="rounded-lg border border-rail-border bg-rail-black p-5">
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
    </ScreenFrame>
  );
}

interface ScreenFrameProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
}

function ScreenFrame({ children, eyebrow, title }: ScreenFrameProps) {
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

interface MetricProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function Metric({ icon, label, value }: MetricProps) {
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

interface MiniProofProps {
  label: string;
  value: string;
}

function MiniProof({ label, value }: MiniProofProps) {
  return (
    <div className="rounded-lg border border-rail-border bg-rail-panel p-5">
      <p className="text-sm text-rail-secondary">{label}</p>
      <p className="mt-2 text-xl font-semibold text-rail-text">{value}</p>
    </div>
  );
}

interface PolicyFieldProps {
  label: string;
  value: string;
}

function PolicyField({ label, value }: PolicyFieldProps) {
  return (
    <div className="rounded-lg border border-rail-border bg-rail-black px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-rail-muted">{label}</p>
      <p className="mt-2 font-semibold text-rail-text">{value}</p>
    </div>
  );
}

interface ActivityCardProps {
  event: ActivityEvent;
  featured?: boolean;
}

function ActivityCard({ event, featured = false }: ActivityCardProps) {
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
      className={`rounded-lg border p-5 ${tone} ${featured ? "shadow-[0_0_60px_rgba(255,90,102,0.14)]" : ""}`}
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

function WardenPanel({ state }: WardenPanelProps) {
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

type StatusTone = "green" | "blue" | "amber";

interface StatusPillProps {
  label: string;
  tone: StatusTone;
}

function StatusPill({ label, tone }: StatusPillProps) {
  const styles: Record<StatusTone, string> = {
    green: "border-rail-green/35 bg-rail-green/10 text-rail-green",
    blue: "border-rail-blue/35 bg-rail-blue/10 text-rail-blue",
    amber: "border-rail-amber/35 bg-rail-amber/10 text-rail-amber",
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles[tone]}`}>{label}</span>;
}

interface RailButtonProps extends ComponentPropsWithoutRef<"button"> {
  icon?: ReactNode;
  size?: "md" | "lg";
}

function RailButton({ children, className = "", icon, size = "md", ...props }: RailButtonProps) {
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

export default App;
