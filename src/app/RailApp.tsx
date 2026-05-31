import { startTransition, useEffect, useRef, useState } from "react";
import { Header, Hero, LandingStory } from "../components/landing/LandingPage";
import { ProductWorkspace } from "../components/workspace/Workspace";
import {
  activatePolicy,
  activationSteps,
  defaultGoal,
  draftingSteps,
  generatePolicy,
  samplePolicy,
  signPolicy,
  simulateAgentActivity,
} from "../domain/mockRail";
import type { ActivityEvent, AppStage, PolicyDraft, WalletState } from "../domain/types";

export function RailApp() {
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
