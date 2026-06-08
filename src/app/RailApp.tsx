import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { Header, Hero, LandingStory } from "../components/landing/LandingPage";
import { ProductWorkspace } from "../components/workspace/Workspace";
import {
  activatePolicy,
  activationSteps,
  createLocalActivity,
  defaultGoal,
  disconnectedAccount,
  draftingSteps,
  samplePolicy,
  signPolicy,
} from "../domain/mockRail";
import { assetTicker } from "../domain/assets";
import type { ActivityEvent, AppStage, PolicyDraft, UserAccount } from "../domain/types";

import { contractAddresses } from "../contracts/addresses";
import { useRailContracts } from "../contracts/useRailContracts";
import { draftPolicyFromAgent, executeAgentAction, fetchRailHealth, type AgentDemoScenario, type RailHealth } from "../services/railApi";
import { useRailWallet } from "../wallet/useRailWallet";

const intervalMsByUnit = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
  years: 31_536_000_000,
} as const;

function policyIntervalMs(policy: Pick<PolicyDraft, "intervalValue" | "intervalUnit">) {
  return Math.max(1_000, policy.intervalValue * intervalMsByUnit[policy.intervalUnit]);
}

export function RailApp() {
  const appRef = useRef<HTMLDivElement>(null);
  const railWallet = useRailWallet();
  const [stage, setStage] = useState<AppStage>("landing");
  const [account, setAccount] = useState<UserAccount>(disconnectedAccount);
  const [goal, setGoal] = useState(defaultGoal);
  const [policy, setPolicy] = useState<PolicyDraft | null>(null);
  const [draftingStep, setDraftingStep] = useState(0);
  const [activationStep, setActivationStep] = useState(0);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [health, setHealth] = useState<RailHealth | null>(null);
  const [isAutomationRunning, setIsAutomationRunning] = useState(false);
  const automationAmountRef = useRef<number | undefined>(undefined);
  const automationInFlightRef = useRef(false);

  const {
    canWriteContracts,
    createPolicy: createPolicyOnchain,
    depositAsset,
    pausePolicy: pausePolicyOnchain,
    resumePolicy: resumePolicyOnchain,
    revokePolicy: revokePolicyOnchain,
    refreshBalances,
    vaultBalanceUSDC,
    vaultBalanceWETH,
    withdrawAsset,
  } = useRailContracts(account);
  const activePolicy = policy ?? samplePolicy;

  const moveToApp = (nextStage: AppStage) => {
    startTransition(() => {
      setStage(nextStage);
    });

    window.setTimeout(() => {
      appRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const pushActivity = useCallback((event: ActivityEvent) => {
    setActivity((current) => [event, ...current]);
  }, []);

  const handleConnectWallet = () => {
    setAccount({ ...disconnectedAccount, status: "connecting" });

    void railWallet.connect().catch((error) => {
      setAccount({
        ...disconnectedAccount,
        error: error instanceof Error ? error.message : "Wallet connection failed. Install or unlock a browser wallet to use Rail.",
      });
    });
  };

  const handleSwitchNetwork = () => {
    setAccount((current) => ({ ...current, status: "connecting" }));

    void railWallet
      .switchToPrimaryChain()
      .then(() => {
        moveToApp("goal");
      })
      .catch((error) => {
        setAccount((current) => ({
          ...current,
          status: "wrong-network",
          error: error instanceof Error ? error.message : "Switch to Robinhood Chain Testnet to continue.",
        }));
      });
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


  const handleCheckHealth = () => {
    void fetchRailHealth()
      .then(setHealth)
      .catch(() => {
        setHealth({
          ok: false,
          service: "rail-agent",
          openaiConfigured: false,
          robinhoodRpcConfigured: false,
          contractsConfigured: false,
        });
      });
  };

  const inputVaultBalance = (targetPolicy: PolicyDraft, targetAccount: UserAccount) =>
    targetPolicy.inputAsset === "ETH" ? targetAccount.vaultBalanceWETH : targetAccount.vaultBalanceUSDC;

  const runRailAction = useCallback((scenario: AgentDemoScenario, requestedAmount?: number) => {
    const amount = requestedAmount && requestedAmount > 0 ? requestedAmount : activePolicy.spendPerExecutionUSDC;
    const baseProjectedReserve = Math.max(0, inputVaultBalance(activePolicy, account) - amount);
    const overrides =
      scenario === "blocked-slippage"
        ? { amountUSDC: amount, slippageBps: activePolicy.slippageBps + 75, projectedReserveUSDC: baseProjectedReserve }
        : {
            amountUSDC: amount,
            slippageBps: Math.max(1, activePolicy.slippageBps - 25),
            projectedReserveUSDC: baseProjectedReserve,
          };

    if (!account.address || !canWriteContracts) {
      pushActivity(
        createLocalActivity({
          kind: "failed",
          policyId: activePolicy.id,
          title: "Wallet required",
          attempted: "dca-swap: " + overrides.amountUSDC + " " + assetTicker(activePolicy.inputAsset) + " -> " + assetTicker(activePolicy.outputAsset),
          reason: "Connect your wallet on Robinhood Chain Testnet before running Rail automation.",
          rule: "Connected wallet",
          fundsMoved: "0 " + assetTicker(activePolicy.inputAsset),
          actionType: "dca-swap",
          simulationResult: "failed",
          transaction: {
            chainId: activePolicy.chainId,
            contractAddress: activePolicy.contractAddress,
            status: "not-submitted",
          },
        }),
      );
      return Promise.resolve();
    }

    return executeAgentAction(activePolicy, account, overrides)
      .then((result) => {
        pushActivity(result.activity);
        if (result.status === "executed") {
          const executedAmount = overrides.amountUSDC ?? activePolicy.spendPerExecutionUSDC;
          setAccount((current) => ({
            ...current,
            vaultBalanceUSDC:
              activePolicy.inputAsset === "USDC"
                ? Math.max(0, current.vaultBalanceUSDC - executedAmount)
                : current.vaultBalanceUSDC + (activePolicy.outputAsset === "USDC" ? executedAmount : 0),
            vaultBalanceWETH:
              activePolicy.inputAsset === "ETH"
                ? Math.max(0, current.vaultBalanceWETH - executedAmount)
                : current.vaultBalanceWETH + (activePolicy.outputAsset === "ETH" ? executedAmount : 0),
          }));
          void refreshBalances();
        }
      })
      .catch((error) => {
        pushActivity(
          createLocalActivity({
            kind: "failed",
            policyId: activePolicy.id,
            title: "Agent execution failed",
            attempted: "dca-swap: " + (overrides.amountUSDC ?? activePolicy.spendPerExecutionUSDC) + " " + activePolicy.inputAsset + " -> " + activePolicy.outputAsset,
            reason: error instanceof Error ? error.message : "Backend could not submit the onchain agent action.",
            rule: "AgentExecutor transaction",
            fundsMoved: "0 " + assetTicker(activePolicy.inputAsset),
            actionType: "dca-swap",
            simulationResult: "failed",
            transaction: {
              chainId: activePolicy.chainId,
              contractAddress: activePolicy.contractAddress,
              status: "failed",
            },
          }),
        );
      });
  }, [account, activePolicy, canWriteContracts, pushActivity, refreshBalances]);

  const handleRunAgentDemo = (scenario: AgentDemoScenario, requestedAmount?: number) => {
    void runRailAction(scenario, requestedAmount);
  };

  const runAutomationTick = useCallback((amount?: number) => {
    if (automationInFlightRef.current) {
      return;
    }

    automationInFlightRef.current = true;
    void runRailAction("valid", amount).finally(() => {
      automationInFlightRef.current = false;
    });
  }, [runRailAction]);

  const handleToggleAutomation = (amount?: number) => {
    if (isAutomationRunning) {
      setIsAutomationRunning(false);
      pushActivity(
        createLocalActivity({
          kind: "review-needed",
          policyId: activePolicy.id,
          title: "Rail automation stopped",
          attempted: "Stop scheduled agent loop",
          reason: "The local demo operator stopped automatic scheduled executions. The onchain policy remains active until paused or revoked.",
          rule: "User operator control",
          fundsMoved: "0 " + assetTicker(activePolicy.inputAsset),
          actionType: "policy-update",
          transaction: { chainId: activePolicy.chainId, contractAddress: activePolicy.contractAddress, status: "not-submitted" },
        }),
      );
      return;
    }

    automationAmountRef.current = amount && amount > 0 ? amount : activePolicy.spendPerExecutionUSDC;
    setIsAutomationRunning(true);
    pushActivity(
      createLocalActivity({
        kind: "review-needed",
        policyId: activePolicy.id,
        title: "Rail automation started",
        attempted: "Run " + assetTicker(activePolicy.inputAsset) + " -> " + assetTicker(activePolicy.outputAsset) + " every " + activePolicy.intervalValue + " " + activePolicy.intervalUnit,
        reason: "Rail will submit scheduled agent actions until the operator stops it or the policy blocks execution.",
        rule: "Signed cadence",
        fundsMoved: "0 " + assetTicker(activePolicy.inputAsset),
        actionType: "policy-update",
        transaction: { chainId: activePolicy.chainId, contractAddress: activePolicy.contractAddress, status: "not-submitted" },
      }),
    );
    runAutomationTick(automationAmountRef.current);
  };


  const updatePolicyStatus = (status: PolicyDraft["status"], title: string, reason: string, txHash?: string) => {
    const updatedPolicy = { ...activePolicy, status, updatedAt: new Date().toISOString() };
    setPolicy(updatedPolicy);
    pushActivity(
      createLocalActivity({
        kind: status === "revoked" ? "blocked" : "review-needed",
        policyId: updatedPolicy.id,
        title,
        attempted: `${updatedPolicy.strategy} policy status update`,
        reason,
        rule: "User confirmation",
        fundsMoved: "0 USDC",
        actionType: "policy-update",
        txHash,
        transaction: {
          chainId: updatedPolicy.chainId,
          contractAddress: updatedPolicy.contractAddress,
          hash: txHash,
          status: txHash ? "confirmed" : "not-submitted",
        },
      }),
    );
  };

  const handlePolicyStatusChange = (status: Extract<PolicyDraft["status"], "active" | "paused" | "revoked">, title: string, reason: string) => {
    void (async () => {
      let txHash: string | undefined;
      if (canWriteContracts) {
        if (status === "paused") txHash = await pausePolicyOnchain(activePolicy);
        if (status === "active") txHash = await resumePolicyOnchain(activePolicy);
        if (status === "revoked") txHash = await revokePolicyOnchain(activePolicy);
      }
      updatePolicyStatus(status, title, txHash ? `${reason} Confirmed onchain.` : reason, txHash);
    })().catch((error) => {
      pushActivity(
        createLocalActivity({
          kind: "failed",
          policyId: activePolicy.id,
          title: `${title} failed`,
          attempted: `${activePolicy.strategy} policy status update`,
          reason: error instanceof Error ? error.message : "Policy status update failed.",
          rule: "PolicyVault owner transaction",
          fundsMoved: "0 USDC",
          actionType: "policy-update",
          simulationResult: "failed",
          transaction: {
            chainId: activePolicy.chainId,
            contractAddress: activePolicy.contractAddress,
            status: "failed",
          },
        }),
      );
    });
  };


  useEffect(() => {
    if (vaultBalanceUSDC === undefined && vaultBalanceWETH === undefined) {
      return;
    }

    setAccount((current) => ({
      ...current,
      vaultBalanceUSDC: vaultBalanceUSDC ?? current.vaultBalanceUSDC,
      vaultBalanceWETH: vaultBalanceWETH ?? current.vaultBalanceWETH,
    }));
  }, [vaultBalanceUSDC, vaultBalanceWETH]);

  useEffect(() => {
    setAccount((current) => ({
      ...railWallet.account,
      vaultBalanceUSDC: current.vaultBalanceUSDC,
      vaultBalanceWETH: current.vaultBalanceWETH,
    }));

    if (railWallet.account.status === "connected" && stage === "connect") {
      moveToApp("goal");
    }
  }, [railWallet.account.address, railWallet.account.chainId, railWallet.account.error, railWallet.account.status, stage]);

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
      void draftPolicyFromAgent(goal, account).then(({ policy: draft, provider }) => {
        setPolicy({
          ...draft,
          warnings: [...draft.warnings, `Draft provider: ${provider}`],
        });
        moveToApp("review");
      });
    }, draftingSteps.length * 430 + 420);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(finishTimer);
    };
  }, [account.address, goal, stage]);

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
        .then(async (pendingPolicy) => {
          if (!account.address || !canWriteContracts) {
            throw new Error("Connect your wallet on Robinhood Chain Testnet before signing a Rail policy.");
          }

          const result = await createPolicyOnchain(pendingPolicy);
          const activatedPolicy = await activatePolicy(pendingPolicy);
          return {
            activatedPolicy: {
              ...activatedPolicy,
              id: result.policyId ?? pendingPolicy.id,
              ownerAddress: account.address,
              contractAddress: contractAddresses.policyVault,
            },
            txHash: result.hash,
          };
        })
        .then(({ activatedPolicy, txHash }) => {
          setPolicy(activatedPolicy);
          setActivity([
            createLocalActivity({
              kind: "executed",
              policyId: activatedPolicy.id,
              title: "Policy created onchain",
              attempted: "Create PolicyVault policy",
              reason: "Wallet confirmed PolicyVault.createPolicy and Rail captured the onchain policy ID.",
              rule: "User signature required",
              fundsMoved: "0 USDC",
              actionType: "policy-update",
              txHash,
              transaction: {
                chainId: activatedPolicy.chainId,
                contractAddress: activatedPolicy.contractAddress,
                hash: txHash,
                status: "confirmed",
              },
            }),
          ]);
          moveToApp("dashboard");
        })
        .catch((error) => {
          setPolicy({ ...activePolicy, status: "failed", updatedAt: new Date().toISOString() });
          setActivity([
            createLocalActivity({
              kind: "failed",
              policyId: activePolicy.id,
              title: "Policy activation failed",
              attempted: "Create PolicyVault policy",
              reason: error instanceof Error ? error.message : "Unable to activate policy.",
              rule: "Wallet transaction",
              fundsMoved: "0 USDC",
              actionType: "policy-update",
            }),
          ]);
          moveToApp("dashboard");
        });
    }, activationSteps.length * 560 + 450);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(finishTimer);
    };
  }, [account.address, activePolicy, canWriteContracts, createPolicyOnchain, stage]);

  useEffect(() => {
    if (!isAutomationRunning || activePolicy.status !== "active") {
      return;
    }

    const timer = window.setInterval(() => {
      runAutomationTick(automationAmountRef.current);
    }, policyIntervalMs(activePolicy));

    return () => window.clearInterval(timer);
  }, [activePolicy, isAutomationRunning, runAutomationTick]);

  useEffect(() => {
    if (activePolicy.status !== "active" && isAutomationRunning) {
      setIsAutomationRunning(false);
    }
  }, [activePolicy.status, isAutomationRunning]);

  const handleDeposit = (amount: number, asset: string) => {
    void (async () => {
      if (!account.address || !canWriteContracts) {
        throw new Error("Connect your wallet on Robinhood Chain Testnet before depositing.");
      }

      const result = await depositAsset(asset, amount);
      setAccount((current) => ({
        ...current,
        vaultBalanceUSDC: asset === "USDC" ? current.vaultBalanceUSDC + amount : current.vaultBalanceUSDC,
        vaultBalanceWETH: asset === "ETH" ? current.vaultBalanceWETH + amount : current.vaultBalanceWETH,
      }));
      pushActivity(
        createLocalActivity({
          kind: "executed",
          policyId: activePolicy.id,
          title: "Deposited " + amount + " " + assetTicker(asset) + " onchain",
          attempted: "Mint demo " + assetTicker(asset) + ", approve PolicyVault, deposit funds",
          reason: "Wallet confirmed the test token mint, allowance approval, and PolicyVault deposit.",
          rule: "User-confirmed deposit",
          fundsMoved: amount + " " + assetTicker(asset),
          actionType: "deposit",
          txHash: result.depositHash,
          transaction: {
            chainId: activePolicy.chainId,
            contractAddress: contractAddresses.policyVault,
            hash: result.depositHash,
            status: "confirmed",
          },
        }),
      );
      void refreshBalances();
    })().catch((error) => {
      pushActivity(
        createLocalActivity({
          kind: "failed",
          policyId: activePolicy.id,
          title: "Deposit failed",
          attempted: "Deposit funds into PolicyVault",
          reason: error instanceof Error ? error.message : "Deposit transaction failed.",
          rule: "Token approval and vault deposit",
          fundsMoved: "0 " + assetTicker(asset),
          actionType: "deposit",
          simulationResult: "failed",
          transaction: { chainId: activePolicy.chainId, contractAddress: contractAddresses.policyVault, status: "failed" },
        }),
      );
    });
  };

  const handleWithdraw = (amount: number, asset: string) => {
    void (async () => {
      if (!account.address || !canWriteContracts) {
        throw new Error("Connect your wallet on Robinhood Chain Testnet before withdrawing.");
      }

      const txHash = await withdrawAsset(asset, amount);
      setAccount((current) => ({
        ...current,
        vaultBalanceUSDC: asset === "USDC" ? Math.max(0, current.vaultBalanceUSDC - amount) : current.vaultBalanceUSDC,
        vaultBalanceWETH: asset === "ETH" ? Math.max(0, current.vaultBalanceWETH - amount) : current.vaultBalanceWETH,
      }));
      pushActivity(
        createLocalActivity({
          kind: "executed",
          policyId: activePolicy.id,
          title: "Withdrew " + amount + " " + assetTicker(asset) + " onchain",
          attempted: "Withdraw funds from PolicyVault",
          reason: "Wallet confirmed owner-only vault withdrawal.",
          rule: "Owner-only withdrawal",
          fundsMoved: amount + " " + assetTicker(asset),
          actionType: "withdraw",
          txHash,
          transaction: {
            chainId: activePolicy.chainId,
            contractAddress: contractAddresses.policyVault,
            hash: txHash,
            status: "confirmed",
          },
        }),
      );
      void refreshBalances();
    })().catch((error) => {
      pushActivity(
        createLocalActivity({
          kind: "failed",
          policyId: activePolicy.id,
          title: "Withdrawal failed",
          attempted: "Withdraw funds from PolicyVault",
          reason: error instanceof Error ? error.message : "Withdrawal transaction failed.",
          rule: "Owner-only withdrawal",
          fundsMoved: "0 " + assetTicker(asset),
          actionType: "withdraw",
          simulationResult: "failed",
          transaction: { chainId: activePolicy.chainId, contractAddress: contractAddresses.policyVault, status: "failed" },
        }),
      );
    });
  };


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
              account={account}
              activity={activity}
              activationStep={activationStep}
              draftingStep={draftingStep}
              goal={goal}
              health={health}
              onCheckHealth={handleCheckHealth}
              onConnect={handleConnectWallet}
              onDeposit={handleDeposit}
              onGeneratePolicy={handleGeneratePolicy}
              onGoalChange={setGoal}
              onLaunch={() => moveToApp("connect")}
              onPause={() => handlePolicyStatusChange("paused", "Automation paused", "Agent execution is stopped until the user resumes.")}
              onReset={() => {
                railWallet.disconnect();
                setIsAutomationRunning(false);
                setAccount(disconnectedAccount);
                setPolicy(null);
                setActivity([]);
                setGoal(defaultGoal);
                moveToApp("connect");
              }}
              onResume={() => handlePolicyStatusChange("active", "Automation resumed", "Agent execution can continue inside the approved policy.")}
              onRevoke={() => handlePolicyStatusChange("revoked", "Policy revoked", "Future agent actions are disabled for this policy.")}
              onRunAgentDemo={handleRunAgentDemo}
              onSign={handleSignPolicy}
              onSwitchNetwork={handleSwitchNetwork}
              onUpdatePolicy={setPolicy}
              onToggleAutomation={handleToggleAutomation}
              onWithdraw={handleWithdraw}
              isAutomationRunning={isAutomationRunning}
              isLiveMode={canWriteContracts}
              policy={activePolicy}
              stage={stage}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
