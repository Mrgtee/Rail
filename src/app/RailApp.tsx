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
import { assetTicker } from "../domain/assets";
import type { ActivityEvent, AppStage, PolicyDraft, UserAccount } from "../domain/types";
import { contractAddresses } from "../contracts/addresses";
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

  const inputVaultBalance = (targetPolicy: PolicyDraft, targetAccount: UserAccount) =>
    targetPolicy.inputAsset === "ETH" ? targetAccount.vaultBalanceWETH : targetAccount.vaultBalanceUSDC;

  const handleRunAgentDemo = (scenario: AgentDemoScenario, requestedAmount?: number) => {
    const amount = requestedAmount && requestedAmount > 0 ? requestedAmount : activePolicy.spendPerExecutionUSDC;
    const baseProjectedReserve = Math.max(0, inputVaultBalance(activePolicy, account) - amount);
    const overrides =
      scenario === "blocked-slippage"
        ? { amountUSDC: amount, slippageBps: activePolicy.slippageBps + 75, projectedReserveUSDC: baseProjectedReserve }
        : scenario === "blocked-overspend"
          ? { amountUSDC: activePolicy.spendPerExecutionUSDC + 15, projectedReserveUSDC: Math.max(0, inputVaultBalance(activePolicy, account) - activePolicy.spendPerExecutionUSDC - 15) }
          : {
              amountUSDC: amount,
              slippageBps: Math.max(1, activePolicy.slippageBps - 25),
              projectedReserveUSDC: baseProjectedReserve,
            };

    void executeAgentAction(activePolicy, account, overrides)
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
          if (!isDemoWallet && canWriteContracts) {
            void refreshBalances();
          }
        }
      })
      .catch((error) => {
        if (!isDemoWallet && canWriteContracts) {
          pushActivity(
            createLocalActivity({
              kind: "failed",
              policyId: activePolicy.id,
              title: "Agent execution failed",
              attempted: `dca-swap: ${overrides.amountUSDC ?? activePolicy.spendPerExecutionUSDC} ${activePolicy.inputAsset} -> ${activePolicy.outputAsset}`,
              reason: error instanceof Error ? error.message : "Backend could not submit the onchain agent action.",
              rule: "AgentExecutor transaction",
              fundsMoved: `0 ${assetTicker(activePolicy.inputAsset)}`,
              actionType: "dca-swap",
              simulationResult: "failed",
              transaction: {
                chainId: activePolicy.chainId,
                contractAddress: activePolicy.contractAddress,
                status: "failed",
              },
            }),
          );
          return;
        }

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
            fundsMoved: isBlocked ? `0 ${assetTicker(activePolicy.inputAsset)}` : `${amount} ${assetTicker(activePolicy.inputAsset)}`,
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
      if (!isDemoWallet && canWriteContracts) {
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
    if (isDemoWallet) {
      return;
    }

    setAccount((current) => ({
      ...railWallet.account,
      vaultBalanceUSDC: current.vaultBalanceUSDC || demoAccount.vaultBalanceUSDC,
      vaultBalanceWETH: current.vaultBalanceWETH || demoAccount.vaultBalanceWETH,
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
          let onchainPolicyId: string | undefined;

          if (!isDemoWallet && canWriteContracts) {
            const result = await createPolicyOnchain(pendingPolicy);
            txHash = result.hash;
            onchainPolicyId = result.policyId;
          }

          const activatedPolicy = await activatePolicy(pendingPolicy);
          return {
            activatedPolicy: {
              ...activatedPolicy,
              id: onchainPolicyId ?? activatedPolicy.id,
              ownerAddress: account.address,
              contractAddress: txHash ? contractAddresses.policyVault : activatedPolicy.contractAddress,
            },
            txHash,
          };
        })
        .then(({ activatedPolicy, txHash }) => {
          setPolicy(activatedPolicy);
          setActivity([
            createLocalActivity({
              kind: "executed",
              policyId: activatedPolicy.id,
              title: txHash ? "Policy created onchain" : "Policy activated in demo mode",
              attempted: "Create PolicyVault policy",
              reason: txHash ? "Wallet confirmed PolicyVault.createPolicy and Rail captured the onchain policy ID." : "No contract addresses were configured, so Rail used demo activation.",
              rule: "User signature required",
              fundsMoved: "0 USDC",
              actionType: "policy-update",
              txHash,
              transaction: {
                chainId: activatedPolicy.chainId,
                contractAddress: activatedPolicy.contractAddress,
                hash: txHash,
                status: txHash ? "confirmed" : "not-submitted",
              },
            }),
            ...(txHash ? [] : simulateAgentActivity()),
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
              onDeposit={(amount, asset) => {
                void (async () => {
                  if (!isDemoWallet && canWriteContracts) {
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
                        title: `Deposited ${amount} ${assetTicker(asset)} onchain`,
                        attempted: `Mint demo ${assetTicker(asset)}, approve PolicyVault, deposit funds`,
                        reason: "Wallet confirmed the test token mint, allowance approval, and PolicyVault deposit.",
                        rule: "User-confirmed deposit",
                        fundsMoved: `${amount} ${assetTicker(asset)}`,
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
                    return;
                  }

                  setAccount((current) => ({
                    ...current,
                    vaultBalanceUSDC: asset === "USDC" ? current.vaultBalanceUSDC + amount : current.vaultBalanceUSDC,
                    vaultBalanceWETH: asset === "ETH" ? current.vaultBalanceWETH + amount : current.vaultBalanceWETH,
                  }));
                  pushActivity(
                    createLocalActivity({
                      kind: "executed",
                      title: `Deposited ${amount} ${assetTicker(asset)}`,
                      attempted: "Deposit funds into PolicyVault",
                      reason: "Vault balance updated in demo mode.",
                      rule: "User-confirmed deposit",
                      fundsMoved: `${amount} ${assetTicker(asset)}`,
                      actionType: "deposit",
                    }),
                  );
                })().catch((error) => {
                  pushActivity(
                    createLocalActivity({
                      kind: "failed",
                      policyId: activePolicy.id,
                      title: "Deposit failed",
                      attempted: "Deposit funds into PolicyVault",
                      reason: error instanceof Error ? error.message : "Deposit transaction failed.",
                      rule: "Token approval and vault deposit",
                      fundsMoved: `0 ${assetTicker(asset)}`,
                      actionType: "deposit",
                      simulationResult: "failed",
                      transaction: { chainId: activePolicy.chainId, contractAddress: contractAddresses.policyVault, status: "failed" },
                    }),
                  );
                });
              }}
              onGeneratePolicy={handleGeneratePolicy}
              onGoalChange={setGoal}
              onLaunch={() => moveToApp("connect")}
              onPause={() => handlePolicyStatusChange("paused", "Automation paused", "Agent execution is stopped until the user resumes.")}
              onReset={() => {
                railWallet.disconnect();
                setIsDemoWallet(true);
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
              onWithdraw={(amount, asset) => {
                void (async () => {
                  if (!isDemoWallet && canWriteContracts) {
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
                        title: `Withdrew ${amount} ${assetTicker(asset)} onchain`,
                        attempted: "Withdraw funds from PolicyVault",
                        reason: "Wallet confirmed owner-only vault withdrawal.",
                        rule: "Owner-only withdrawal",
                        fundsMoved: `${amount} ${assetTicker(asset)}`,
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
                    return;
                  }

                  setAccount((current) => ({
                    ...current,
                    vaultBalanceUSDC: asset === "USDC" ? Math.max(0, current.vaultBalanceUSDC - amount) : current.vaultBalanceUSDC,
                    vaultBalanceWETH: asset === "ETH" ? Math.max(0, current.vaultBalanceWETH - amount) : current.vaultBalanceWETH,
                  }));
                  pushActivity(
                    createLocalActivity({
                      kind: "executed",
                      title: `Withdrew ${amount} ${assetTicker(asset)}`,
                      attempted: "Withdraw funds from PolicyVault",
                      reason: "User withdrawal completed in demo mode.",
                      rule: "Owner-only withdrawal",
                      fundsMoved: `${amount} ${assetTicker(asset)}`,
                      actionType: "withdraw",
                    }),
                  );
                })().catch((error) => {
                  pushActivity(
                    createLocalActivity({
                      kind: "failed",
                      policyId: activePolicy.id,
                      title: "Withdrawal failed",
                      attempted: "Withdraw funds from PolicyVault",
                      reason: error instanceof Error ? error.message : "Withdrawal transaction failed.",
                      rule: "Owner-only withdrawal",
                      fundsMoved: `0 ${assetTicker(asset)}`,
                      actionType: "withdraw",
                      simulationResult: "failed",
                      transaction: { chainId: activePolicy.chainId, contractAddress: contractAddresses.policyVault, status: "failed" },
                    }),
                  );
                });
              }}
              isLiveMode={!isDemoWallet && canWriteContracts}
              policy={activePolicy}
              stage={stage}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
