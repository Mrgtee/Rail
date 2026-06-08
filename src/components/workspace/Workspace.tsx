import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  LockKeyhole,
  PauseCircle,
  Play,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { assetTicker, displayAsset, pairedSwapAsset, supportedSwapAssets } from "../../domain/assets";
import { explorerAddressUrl, explorerTxUrl, primaryChain } from "../../domain/chains";
import { activationSteps, draftingSteps } from "../../domain/mockRail";
import { formatAssetAmount, formatSlippage, intervalLabel, policyFields, policyRoute, shortAddress } from "../../domain/formatters";
import type { ActivityEvent, AppStage, IntervalUnit, PolicyDraft, UserAccount } from "../../domain/types";
import type { AgentDemoScenario, RailHealth } from "../../services/railApi";
import {
  ActivityCard,
  Metric,
  MiniProof,
  PolicyField,
  ProofLine,
  RailButton,
  ScreenFrame,
  StatusPill,
  WardenPanel,
} from "../shared/RailUi";

const chips = ["DCA weekly", "Keep reserve", "Set slippage limit", "Stop after date"];

interface ProductWorkspaceProps {
  account: UserAccount;
  activity: ActivityEvent[];
  activationStep: number;
  draftingStep: number;
  goal: string;
  onConnect: () => void;
  health: RailHealth | null;
  onCheckHealth: () => void;
  onDeposit: (amount: number, asset: string) => void;
  onFundWallet: (amount: number, asset: string) => void;
  onGeneratePolicy: () => void;
  onGoalChange: (goal: string) => void;
  onLaunch: () => void;
  onPause: () => void;
  onReset: () => void;
  onResume: () => void;
  onRevoke: () => void;
  onRunAgentDemo: (scenario: AgentDemoScenario, amount?: number) => void;
  onToggleAutomation: (amount?: number) => void;
  onSign: () => void;
  onSwitchNetwork: () => void;
  onUpdatePolicy: (policy: PolicyDraft) => void;
  onWithdraw: (amount: number, asset: string) => void;
  isAutomationRunning: boolean;
  isLiveMode: boolean;
  policy: PolicyDraft;
  stage: AppStage;
}

export function ProductWorkspace({
  account,
  activity,
  activationStep,
  draftingStep,
  goal,
  health,
  onCheckHealth,
  onConnect,
  onDeposit,
  onFundWallet,
  onGeneratePolicy,
  onGoalChange,
  onLaunch,
  onPause,
  onReset,
  onResume,
  onRevoke,
  onRunAgentDemo,
  onToggleAutomation,
  onSign,
  onSwitchNetwork,
  onUpdatePolicy,
  onWithdraw,
  isAutomationRunning,
  isLiveMode,
  policy,
  stage,
}: ProductWorkspaceProps) {
  return (
    <div className="rounded-lg border border-rail-border bg-rail-graphite shadow-glow">
      <div className="flex flex-col justify-between gap-4 border-b border-rail-border p-5 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rail-muted">Interactive MVP</p>
          <h2 className="mt-2 text-2xl font-semibold text-rail-text">Policy automation workspace</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={`${primaryChain.name} · ${primaryChain.id}`} tone="blue" />
          <StatusPill label={isLiveMode ? "Onchain ready" : "Wallet required"} tone={isLiveMode ? "green" : "amber"} />
          {account.status === "connected" ? <StatusPill label={`Wallet ${shortAddress(account.address)}`} tone="green" /> : null}
          {account.status === "wrong-network" ? <StatusPill label="Wrong network" tone="red" /> : null}
        </div>
      </div>
      <div className="grid min-h-[720px] lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-rail-border p-5 lg:border-b-0 lg:border-r">
          <StageRail current={stage} />
        </aside>
        <div className="p-5 sm:p-8">
          <AnimatePresence mode="wait">
            {stage === "landing" ? <WelcomePanel key="welcome" onLaunch={onLaunch} /> : null}
            {stage === "connect" ? (
              <ConnectScreen
                key="connect"
                account={account}
                onConnect={onConnect}
                onSwitchNetwork={onSwitchNetwork}
              />
            ) : null}
            {stage === "goal" ? (
              <GoalScreen key="goal" goal={goal} onGeneratePolicy={onGeneratePolicy} onGoalChange={onGoalChange} />
            ) : null}
            {stage === "drafting" ? <DraftingScreen key="drafting" activeStep={draftingStep} /> : null}
            {stage === "review" ? (
              <PolicyReviewScreen key="review" onSign={onSign} onUpdatePolicy={onUpdatePolicy} policy={policy} />
            ) : null}
            {stage === "activating" ? <ActivationScreen key="activating" activeStep={activationStep} /> : null}
            {stage === "dashboard" ? (
              <DashboardScreen
                key="dashboard"
                account={account}
                activity={activity}
                health={health}
                onCheckHealth={onCheckHealth}
                onDeposit={onDeposit}
                onFundWallet={onFundWallet}
                onPause={onPause}
                onReset={onReset}
                onResume={onResume}
                onRevoke={onRevoke}
                onRunAgentDemo={onRunAgentDemo}
                onToggleAutomation={onToggleAutomation}
                onWithdraw={onWithdraw}
                isAutomationRunning={isAutomationRunning}
                policy={policy}
              />
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
        Start Rail
      </RailButton>
    </ScreenFrame>
  );
}

interface ConnectScreenProps {
  account: UserAccount;
  onConnect: () => void;
  onSwitchNetwork: () => void;
}

function ConnectScreen({ account, onConnect, onSwitchNetwork }: ConnectScreenProps) {
  const isConnecting = account.status === "connecting";
  const isWrongNetwork = account.status === "wrong-network";

  return (
    <ScreenFrame eyebrow="Step 1" title="Connect your wallet to create an automation policy.">
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="rounded-lg border border-rail-border bg-rail-panel p-6">
          <div className="grid h-14 w-14 place-items-center rounded-lg border border-rail-border bg-rail-graphite text-rail-green">
            <WalletCards size={24} />
          </div>
          <p className="mt-6 text-lg leading-8 text-rail-secondary">
Your funds stay controlled by smart contract rules. Rail requires your connected wallet on Robinhood Chain Testnet before policies, deposits, or swaps can run.
          </p>
          {account.address ? (
            <a className="mt-5 block font-mono text-sm text-rail-blue hover:text-rail-text" href={explorerAddressUrl(account.address, account.chainId)} rel="noreferrer" target="_blank">
              {shortAddress(account.address)} · {account.ethBalance?.toFixed(4) ?? "0.0000"} ETH
            </a>
          ) : null}
          {isWrongNetwork ? (
            <div className="mt-6 rounded-lg border border-rail-red/40 bg-rail-red/10 p-4 text-sm text-rail-text">
              <div className="flex items-center gap-2 font-semibold text-rail-red">
                <ShieldAlert size={16} />
                Unsupported network
              </div>
              <p className="mt-2 text-rail-secondary">{account.error}</p>
            </div>
          ) : null}
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <RailButton
              disabled={isConnecting}
              icon={isConnecting ? <Clock3 size={17} /> : <WalletCards size={17} />}
              onClick={onConnect}
              size="lg"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </RailButton>
            {isWrongNetwork ? (
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rail-border px-5 text-sm font-semibold text-rail-text transition hover:border-rail-blue"
                onClick={onSwitchNetwork}
                type="button"
              >
                <RefreshCcw size={17} />
                Switch Network
              </button>
            ) : null}
          </div>
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
  const isEmpty = goal.trim().length < 16;

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
        {isEmpty ? (
          <p className="mt-4 text-sm text-rail-amber">Add an amount, asset, cadence, and risk limit so Rail can create a safe policy.</p>
        ) : null}
        <RailButton className="mt-6" disabled={isEmpty} icon={<Zap size={17} />} onClick={onGeneratePolicy} size="lg">
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
    <ScreenFrame eyebrow="AI draft" title="Rail is translating intent into policy JSON.">
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
  onUpdatePolicy: (policy: PolicyDraft) => void;
  policy: PolicyDraft;
}

function PolicyReviewScreen({ onSign, onUpdatePolicy, policy }: PolicyReviewScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const fields = policyFields(policy);

  const withSummary = (nextPolicy: PolicyDraft): PolicyDraft => ({
    ...nextPolicy,
    summary: `DCA ${nextPolicy.spendPerExecutionUSDC} ${assetTicker(nextPolicy.inputAsset)} into ${assetTicker(nextPolicy.outputAsset)} ${intervalLabel(nextPolicy).toLowerCase()} with ${formatSlippage(nextPolicy.slippageBps)} max slippage.`,
  });

  const updateNumber = (key: keyof Pick<PolicyDraft, "spendPerExecutionUSDC" | "monthlyCapUSDC" | "minimumReserveUSDC" | "expiryDays" | "intervalValue">, value: string) => {
    onUpdatePolicy(withSummary({ ...policy, [key]: Number(value), updatedAt: new Date().toISOString() }));
  };

  const updateInputAsset = (inputAsset: string) => {
    const outputAsset = inputAsset === policy.outputAsset ? pairedSwapAsset(inputAsset) : policy.outputAsset;
    onUpdatePolicy(withSummary({ ...policy, inputAsset, outputAsset, allowedAssets: [inputAsset, outputAsset], updatedAt: new Date().toISOString() }));
  };

  const updateOutputAsset = (outputAsset: string) => {
    const inputAsset = outputAsset === policy.inputAsset ? pairedSwapAsset(outputAsset) : policy.inputAsset;
    onUpdatePolicy(withSummary({ ...policy, inputAsset, outputAsset, allowedAssets: [inputAsset, outputAsset], updatedAt: new Date().toISOString() }));
  };

  return (
    <ScreenFrame eyebrow="Step 3" title="Review the policy before signing.">
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="rounded-lg border border-rail-border bg-rail-panel p-5">
          <div className="flex flex-col justify-between gap-3 border-b border-rail-border pb-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-rail-secondary">Policy Summary</p>
              <h3 className="mt-1 text-2xl font-semibold text-rail-text">{policy.summary}</h3>
            </div>
            <StatusPill label={policy.status === "awaiting-signature" ? "Awaiting signature" : policy.status} tone="amber" />
          </div>
          {isEditing ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <AssetSelect label="Input asset" value={policy.inputAsset} onChange={updateInputAsset} />
              <AssetSelect label="Output asset" value={policy.outputAsset} onChange={updateOutputAsset} />
              <PolicyInput label={`Spend per execution (${assetTicker(policy.inputAsset)})`} value={policy.spendPerExecutionUSDC} onChange={(value) => updateNumber("spendPerExecutionUSDC", value)} />
              <PolicyInput label={`Period cap (${assetTicker(policy.inputAsset)})`} value={policy.monthlyCapUSDC} onChange={(value) => updateNumber("monthlyCapUSDC", value)} />
              <PolicyInput label={`Minimum reserve (${assetTicker(policy.inputAsset)})`} value={policy.minimumReserveUSDC} onChange={(value) => updateNumber("minimumReserveUSDC", value)} />
              <PolicyInput label="Expiry days" value={policy.expiryDays} onChange={(value) => updateNumber("expiryDays", value)} />
              <PolicyInput label="Slippage %" value={policy.slippageBps / 100} onChange={(value) => onUpdatePolicy(withSummary({ ...policy, slippageBps: Number(value) * 100, updatedAt: new Date().toISOString() }))} />
              <PolicyInput label="Interval" value={policy.intervalValue} onChange={(value) => updateNumber("intervalValue", value)} />
              <label className="grid gap-2 text-sm font-semibold text-rail-secondary">
                Interval unit
                <select
                  className="min-h-12 rounded-lg border border-rail-border bg-rail-black px-3 text-rail-text outline-none focus:border-rail-green"
                  onChange={(event) => onUpdatePolicy(withSummary({ ...policy, intervalUnit: event.target.value as IntervalUnit, updatedAt: new Date().toISOString() }))}
                  value={policy.intervalUnit}
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="years">Years</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <PolicyField key={field.label} label={field.label} value={field.value} />
              ))}
            </div>
          )}
          <div className="mt-5 rounded-lg border border-rail-green/30 bg-rail-green/10 p-4 text-sm font-semibold text-rail-green">
            The agent cannot execute outside these limits. Empty or unlimited rules are not allowed in the MVP.
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
              onClick={() => setIsEditing((current) => !current)}
              type="button"
            >
              {isEditing ? "Done Editing" : "Edit Rules"}
            </button>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

interface PolicyInputProps {
  label: string;
  onChange: (value: string) => void;
  value: number;
}

function AssetSelect({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-rail-secondary">
      {label}
      <select
        className="min-h-12 rounded-lg border border-rail-border bg-rail-black px-3 text-rail-text outline-none focus:border-rail-green"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {supportedSwapAssets.map((asset) => (
          <option key={asset} value={asset}>
            {displayAsset(asset)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PolicyInput({ label, onChange, value }: PolicyInputProps) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-rail-secondary">
      {label}
      <input
        className="min-h-12 rounded-lg border border-rail-border bg-rail-black px-3 text-rail-text outline-none focus:border-rail-green"
        min={0}
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
    </label>
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
  account: UserAccount;
  activity: ActivityEvent[];
  health: RailHealth | null;
  onCheckHealth: () => void;
  onDeposit: (amount: number, asset: string) => void;
  onFundWallet: (amount: number, asset: string) => void;
  onPause: () => void;
  onReset: () => void;
  onResume: () => void;
  onRevoke: () => void;
  onRunAgentDemo: (scenario: AgentDemoScenario, amount?: number) => void;
  onToggleAutomation: (amount?: number) => void;
  onWithdraw: (amount: number, asset: string) => void;
  isAutomationRunning: boolean;
  policy: PolicyDraft;
}

function DashboardScreen({ account, activity, health, onCheckHealth, onDeposit, onFundWallet, onPause, onReset, onResume, onRevoke, onRunAgentDemo, onToggleAutomation, onWithdraw, isAutomationRunning, policy }: DashboardScreenProps) {
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);
  const events = useMemo(() => activity, [activity]);
  const isPaused = policy.status === "paused";
  const isRevoked = policy.status === "revoked";
  const inputBalance = policy.inputAsset === "ETH" ? account.vaultBalanceWETH : account.vaultBalanceUSDC;
  const fundAmount = policy.inputAsset === "ETH" ? 0.05 : 100;
  const depositAmount = policy.inputAsset === "ETH" ? 0.01 : 25;
  const withdrawAmount = policy.inputAsset === "ETH" ? 0.005 : 10;

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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Metric icon={<WalletCards size={18} />} label="Wallet rUSDC" value={formatAssetAmount(account.walletBalanceUSDC, "USDC")} />
              <Metric icon={<WalletCards size={18} />} label="Wallet rWETH" value={formatAssetAmount(account.walletBalanceWETH, "ETH")} />
              <Metric icon={<Gauge size={18} />} label="Vault rUSDC" value={formatAssetAmount(account.vaultBalanceUSDC, "USDC")} />
              <Metric icon={<Gauge size={18} />} label="Vault rWETH" value={formatAssetAmount(account.vaultBalanceWETH, "ETH")} />
              <Metric icon={<Play size={18} />} label="Next action" value={isPaused || isRevoked ? "Stopped" : intervalLabel(policy)} />
              <Metric icon={<WalletCards size={18} />} label="Session key" value={account.sessionKeyStatus} />
            </div>
            <div className="rounded-lg border border-rail-border bg-rail-panel/90 p-5 backdrop-blur">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-rail-secondary">Active Policy</p>
                  <h3 className="mt-1 text-2xl font-semibold text-rail-text">{policy.strategy} guardrails</h3>
                </div>
                <StatusPill label={policy.status} tone={policy.status === "active" ? "green" : policy.status === "revoked" ? "red" : "amber"} />
              </div>
              <div className="grid gap-3">
                <PolicyField label="Spend" value={formatAssetAmount(policy.spendPerExecutionUSDC, policy.inputAsset)} />
                <PolicyField label="Allowed pair" value={policyRoute(policy)} />
                <PolicyField label="Cadence" value={intervalLabel(policy)} />
                <PolicyField label="Input vault" value={formatAssetAmount(inputBalance, policy.inputAsset)} />
                <PolicyField label="Slippage limit" value={formatSlippage(policy.slippageBps)} />
                <PolicyField label="Minimum reserve" value={policy.minimumReserveUSDC > 0 ? formatAssetAmount(policy.minimumReserveUSDC, policy.inputAsset) : "None set"} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rail-border px-4 text-sm font-semibold text-rail-secondary transition hover:border-rail-green hover:text-rail-text"
                  onClick={() => onFundWallet(fundAmount, policy.inputAsset)}
                  type="button"
                >
                  <WalletCards size={17} />
                  Fund wallet {fundAmount} {assetTicker(policy.inputAsset)}
                </button>
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rail-border px-4 text-sm font-semibold text-rail-secondary transition hover:border-rail-green hover:text-rail-text"
                  onClick={() => onDeposit(depositAmount, policy.inputAsset)}
                  type="button"
                >
                  <ArrowRight size={17} />
                  Deposit {depositAmount} {assetTicker(policy.inputAsset)}
                </button>
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rail-border px-4 text-sm font-semibold text-rail-secondary transition hover:border-rail-blue hover:text-rail-text"
                  onClick={() => onWithdraw(withdrawAmount, policy.inputAsset)}
                  type="button"
                >
                  <RotateCcw size={17} />
                  Withdraw {withdrawAmount} {assetTicker(policy.inputAsset)}
                </button>
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rail-border px-4 text-sm font-semibold text-rail-secondary transition hover:border-rail-amber hover:text-rail-text"
                  onClick={isPaused ? onResume : onPause}
                  type="button"
                >
                  <PauseCircle size={17} />
                  {isPaused ? "Resume Automation" : "Pause Automation"}
                </button>
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rail-border px-4 text-sm font-semibold text-rail-secondary transition hover:border-rail-red hover:text-rail-text"
                  onClick={isRevoked ? onReset : onRevoke}
                  type="button"
                >
                  <LockKeyhole size={17} />
                  {isRevoked ? "Create New Policy" : "Revoke Policy"}
                </button>
              </div>
            </div>
          </div>
          <div className="grid gap-5">
            <DemoOperatorPanel health={health} isAutomationRunning={isAutomationRunning} onCheckHealth={onCheckHealth} onRunAgentDemo={onRunAgentDemo} onToggleAutomation={onToggleAutomation} policy={policy} />
            <div className="rounded-lg border border-rail-border bg-rail-black/90 p-5 backdrop-blur">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-rail-secondary">Activity Feed</p>
                <h3 className="mt-1 text-2xl font-semibold text-rail-text">Contract decisions</h3>
              </div>
              <StatusPill label="Live" tone="blue" />
            </div>
            <div className="grid gap-4">
              {events.length > 0 ? (
                events.map((event, index) => (
                  <ActivityCard event={event} featured={index === 0} key={event.id} onClick={() => setSelectedEvent(event)} />
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-rail-border p-5 text-sm text-rail-secondary">
                  No contract activity yet. Create a policy, deposit funds, then run Rail automation or an input swap.
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
      {selectedEvent ? <ActivityDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} /> : null}
    </ScreenFrame>
  );
}

interface DemoOperatorPanelProps {
  health: RailHealth | null;
  isAutomationRunning: boolean;
  onCheckHealth: () => void;
  onRunAgentDemo: (scenario: AgentDemoScenario, amount?: number) => void;
  onToggleAutomation: (amount?: number) => void;
  policy: PolicyDraft;
}

function DemoOperatorPanel({ health, isAutomationRunning, onCheckHealth, onRunAgentDemo, onToggleAutomation, policy }: DemoOperatorPanelProps) {
  const [swapAmount, setSwapAmount] = useState(policy.spendPerExecutionUSDC);
  const parsedAmount = Number.isFinite(swapAmount) && swapAmount > 0 ? swapAmount : policy.spendPerExecutionUSDC;

  return (
    <div className="rounded-lg border border-rail-border bg-rail-panel/90 p-5 backdrop-blur">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-rail-secondary">Agent Operator</p>
          <h3 className="mt-1 text-2xl font-semibold text-rail-text">Agent action controls</h3>
        </div>
        <StatusPill label={health?.ok ? "Backend healthy" : "Health unknown"} tone={health?.ok ? "green" : "amber"} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-rail-secondary sm:col-span-2">
          Instant swap amount ({assetTicker(policy.inputAsset)})
          <input
            className="min-h-12 rounded-lg border border-rail-border bg-rail-black px-3 text-rail-text outline-none focus:border-rail-green"
            min={0}
            onChange={(event) => setSwapAmount(Number(event.target.value))}
            type="number"
            value={swapAmount}
          />
        </label>
        <button className="min-h-12 rounded-lg border border-rail-green/40 px-4 text-sm font-semibold text-rail-green transition hover:bg-rail-green/10" onClick={() => onToggleAutomation(parsedAmount)} type="button">
          {isAutomationRunning ? "Stop Rail Automation" : "Start Rail Automation"}
        </button>
        <button className="min-h-12 rounded-lg border border-rail-blue/40 px-4 text-sm font-semibold text-rail-blue transition hover:bg-rail-blue/10" onClick={() => onRunAgentDemo("valid", parsedAmount)} type="button">
          Run Input Swap
        </button>
        <button className="min-h-12 rounded-lg border border-rail-red/40 px-4 text-sm font-semibold text-rail-red transition hover:bg-rail-red/10" onClick={() => onRunAgentDemo("blocked-slippage", parsedAmount)} type="button">
          Trigger Slippage Block
        </button>
        <button className="min-h-12 rounded-lg border border-rail-border px-4 text-sm font-semibold text-rail-secondary transition hover:border-rail-blue hover:text-rail-text" onClick={onCheckHealth} type="button">
          Check Backend Health
        </button>
      </div>
      {health ? (
        <div className="mt-4 grid gap-2 text-xs text-rail-secondary sm:grid-cols-3">
          <span>OpenAI: {health.openaiConfigured ? "configured" : "fallback"}</span>
          <span>RPC: {health.robinhoodRpcConfigured ? "configured" : "fallback"}</span>
          <span>Contracts: {health.contractsConfigured ? "configured" : "fallback"}</span>
        </div>
      ) : null}
    </div>
  );
}

interface ActivityDetailProps {
  event: ActivityEvent;
  onClose: () => void;
}

function ActivityDetail({ event, onClose }: ActivityDetailProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full max-w-xl flex-col rounded-lg border border-rail-border bg-rail-black p-5 shadow-glow">
        <div className="flex items-start justify-between gap-4 border-b border-rail-border pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rail-muted">Action detail</p>
            <h3 className="mt-2 text-2xl font-semibold text-rail-text">{event.title}</h3>
          </div>
          <button className="rounded-lg border border-rail-border p-2 text-rail-secondary hover:text-rail-text" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 py-5">
          <ProofLine label="Attempted" value={event.attempted} />
          <ProofLine label="Rule checked" value={event.rule} />
          <ProofLine label="Simulation" value={event.simulationResult} />
          <ProofLine label="Transaction status" value={event.transaction.status} />
          {event.transaction.hash ? (
            <a className="font-mono text-sm text-rail-blue hover:text-rail-text" href={explorerTxUrl(event.transaction.hash, event.transaction.chainId)} rel="noreferrer" target="_blank">
              View transaction
            </a>
          ) : null}
          <ProofLine label="Funds moved" value={event.fundsMoved} />
          <ProofLine label="Reason" value={event.reason} />
        </div>
      </div>
    </div>
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
