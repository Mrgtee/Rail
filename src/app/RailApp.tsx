import { startTransition, useEffect, useRef, useState } from "react";
import { Header, Hero, LandingStory } from "../components/landing/LandingPage";
import { ProductWorkspace } from "../components/workspace/Workspace";
import {
  activatePolicy,
  activationSteps,
  createLocalActivity,
  defaultGoal,
  demoAccount,
  disconnectedAccount,
  draftingSteps,
  samplePolicy,
  signPolicy,
  simulateAgentActivity,
  wrongNetworkAccount,
} from "../domain/mockRail";
import type { ActivityEvent, AppStage, PolicyDraft, UserAccount } from "../domain/types";
import { useRailContracts } from "../contracts/useRailContracts";
import { draftPolicyFromAgent, executeAgentAction, fetchRailHealth, type AgentDemoScenario, type RailHealth } from "../services/railApi";
import { useRailWallet } from "../wallet/useRailWallet";

export function RailApp() {
  const appRef = useRef<HTMLDivElement>(null);
  const railWallet = useRailWallet();
  const [stage, setStage] = useState<AppStage>("landing");
  const [account, setAccount] = useState<UserAccount>(disconnectedAccount);
  const [isDemoWallet, setIsDemoWallet] = useState(true);
  const [goal, setGoal] = useState(defaultGoal);
  const [policy, setPolicy] = useState<PolicyDraft | null>(null);
  const [draftingStep, setDraftingStep] = useState(0);
  const [activationStep, setActivationStep] = useState(0);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [health, setHealth] = useState<RailHealth | null>(null);

  const { canWriteContracts, createPolicy: createPolicyOnchain, vaultBalanceUSDC } = useRailContracts(account);
  const activePolicy = policy ?? samplePolicy;

  const moveToApp = (nextStage: AppStage) => {
    startTransition(() => {
      setStage(nextStage);
    });

    window.setTimeout(() => {
      appRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const pushActivity = (event: ActivityEvent) => {
    setActivity((current) => [event, ...current]);
  };

  const handleConnectWallet = () => {
    setAccount({ ...disconnectedAccount, status: "connecting" });

    void railWallet
      .connect()
      .then(() => {
        setIsDemoWallet(false);
      })
      .catch(() => {
        setIsDemoWallet(true);
        window.setTimeout(() => {
          setAccount(demoAccount);
          moveToApp("goal");
        }, 450);
      });
  };

  const handleConnectWrongNetwork = () => {
    setIsDemoWallet(true);
    setAccount(wrongNetworkAccount);
  };

  const handleSwitchNetwork = () => {
    setAccount((current) => ({ ...current, status: "connecting" }));

    if (!isDemoWallet) {
      void railWallet
        .switchToPrimaryChain()
        .then(() => {
          moveToApp("goal");
        })
        .catch(() => {
          setIsDemoWallet(true);
          setAccount(demoAccount);
          moveToApp("goal");
        });
      return;
    }

    window.setTimeout(() => {
      setAccount(demoAccount);
      moveToApp("goal");
    }, 500);
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

  const handleRunAgentDemo = (scenario: AgentDemoScenario) => {
    const overrides =
      scenario === "blocked-slippage"
        ? { slippageBps: activePolicy.slippageBps + 75 }
        : scenario === "blocked-overspend"
          ? { amountUSDC: activePolicy.spendPerExecutionUSDC + 15 }
          : {
              amountUSDC: activePolicy.spendPerExecutionUSDC,
              slippageBps: Math.max(1, activePolicy.slippageBps - 25),
              projectedReserveUSDC: Math.max(activePolicy.minimumReserveUSDC, account.vaultBalanceUSDC - activePolicy.spendPerExecutionUSDC),
            };

    void executeAgentAction(activePolicy, account, overrides)
      .then((result) => {
        pushActivity(result.activity);
        if (result.status === "executed") {
          setAccount((current) => ({
            ...current,
            vaultBalanceUSDC: Math.max(0, current.vaultBalanceUSDC - (overrides.amountUSDC ?? activePolicy.spendPerExecutionUSDC)),
          }));
        }
      })
      .catch(() => {
        const isBlocked = scenario !== "valid";
        const amount = overrides.amountUSDC ?? activePolicy.spendPerExecutionUSDC;
        pushActivity(
          createLocalActivity({
            kind: isBlocked ? "blocked" : "executed",
            policyId: activePolicy.id,
            title: isBlocked ? (scenario === "blocked-slippage" ? "Blocked: slippage above policy" : "Blocked: spend above policy") : "Executed demo action",
            attempted: `dca-swap: ${amount} ${activePolicy.inputAsset} -> ${activePolicy.outputAsset}`,
            reason: isBlocked
              ? scenario === "blocked-slippage"
                ? "Route exceeds signed slippage limit."
                : "Action exceeds spend per execution."
              : "Action matched the active policy.",
            rule: isBlocked ? (scenario === "blocked-slippage" ? "Max slippage" : "Max spend per execution") : "PolicyVault checks",
            fundsMoved: isBlocked ? "0 USDC" : `${amount} USDC`,
            actionType: "dca-swap",
            simulationResult: isBlocked ? "blocked" : "passed",
            transaction: {
              chainId: activePolicy.chainId,
              contractAddress: activePolicy.contractAddress,
              status: isBlocked ? "not-submitted" : "confirmed",
              hash: isBlocked ? undefined : "0xlocaldemoexecution",
            },
            txHash: isBlocked ? undefined : "0xlocaldemoexecution",
          }),
        );
      });
  };

  const updatePolicyStatus = (status: PolicyDraft["status"], title: string, reason: string) => {
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
      }),
    );
  };


  useEffect(() => {
    if (vaultBalanceUSDC === undefined) {
      return;
    }

    setAccount((current) => ({ ...current, vaultBalanceUSDC: vaultBalanceUSDC ?? current.vaultBalanceUSDC }));
  }, [vaultBalanceUSDC]);

  useEffect(() => {
    if (isDemoWallet) {
      return;
    }

    setAccount((current) => ({
      ...railWallet.account,
      vaultBalanceUSDC: current.vaultBalanceUSDC || demoAccount.vaultBalanceUSDC,
    }));

    if (railWallet.account.status === "connected" && stage === "connect") {
      moveToApp("goal");
    }
  }, [isDemoWallet, railWallet.account.address, railWallet.account.chainId, railWallet.account.status, stage]);

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
          let txHash: string | undefined;

          if (!isDemoWallet && canWriteContracts) {
            txHash = await createPolicyOnchain(pendingPolicy);
          }

          return { activatedPolicy: await activatePolicy(pendingPolicy), txHash };
        })
        .then(({ activatedPolicy, txHash }) => {
          setPolicy(activatedPolicy);
          setActivity([
            createLocalActivity({
              kind: "executed",
              policyId: activatedPolicy.id,
              title: txHash ? "Policy created onchain" : "Policy activated in demo mode",
              attempted: "Create PolicyVault policy",
              reason: txHash ? "Wallet submitted PolicyVault.createPolicy." : "No contract addresses were configured, so Rail used demo activation.",
              rule: "User signature required",
              fundsMoved: "0 USDC",
              actionType: "policy-update",
              txHash,
              transaction: {
                chainId: activatedPolicy.chainId,
                contractAddress: activatedPolicy.contractAddress,
                hash: txHash,
                status: txHash ? "pending" : "not-submitted",
              },
            }),
            ...simulateAgentActivity(),
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
  }, [activePolicy, canWriteContracts, createPolicyOnchain, isDemoWallet, stage]);

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
              onConnectWrongNetwork={handleConnectWrongNetwork}
              onDeposit={(amount) => {
                setAccount((current) => ({ ...current, vaultBalanceUSDC: current.vaultBalanceUSDC + amount }));
                pushActivity(
                  createLocalActivity({
                    kind: "executed",
                    title: `Deposited ${amount} USDC`,
                    attempted: "Deposit funds into PolicyVault",
                    reason: "Vault balance updated in demo mode.",
                    rule: "User-confirmed deposit",
                    fundsMoved: `${amount} USDC`,
                    actionType: "deposit",
                  }),
                );
              }}
              onGeneratePolicy={handleGeneratePolicy}
              onGoalChange={setGoal}
              onLaunch={() => moveToApp("connect")}
              onPause={() => updatePolicyStatus("paused", "Automation paused", "Agent execution is stopped until the user resumes.")}
              onReset={() => {
                railWallet.disconnect();
                setIsDemoWallet(true);
                setAccount(disconnectedAccount);
                setPolicy(null);
                setActivity([]);
                setGoal(defaultGoal);
                moveToApp("connect");
              }}
              onResume={() => updatePolicyStatus("active", "Automation resumed", "Agent execution can continue inside the approved policy.")}
              onRevoke={() => updatePolicyStatus("revoked", "Policy revoked", "Future agent actions are disabled for this policy.")}
              onRunAgentDemo={handleRunAgentDemo}
              onSign={handleSignPolicy}
              onSwitchNetwork={handleSwitchNetwork}
              onUpdatePolicy={setPolicy}
              onWithdraw={(amount) => {
                setAccount((current) => ({ ...current, vaultBalanceUSDC: Math.max(0, current.vaultBalanceUSDC - amount) }));
                pushActivity(
                  createLocalActivity({
                    kind: "executed",
                    title: `Withdrew ${amount} USDC`,
                    attempted: "Withdraw funds from PolicyVault",
                    reason: "User withdrawal completed in demo mode.",
                    rule: "Owner-only withdrawal",
                    fundsMoved: `${amount} USDC`,
                    actionType: "withdraw",
                  }),
                );
              }}
              policy={activePolicy}
              stage={stage}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
