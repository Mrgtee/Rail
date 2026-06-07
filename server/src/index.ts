import "./env.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { addActivity, listActivity } from "./activityStore.js";
import { simulateAction, validatePolicy } from "./agent.js";
import { railContractsConfigured, submitAgentExecution, submitBlockedAction } from "./contracts.js";
import { draftPolicy } from "./policy.js";
import { agentActionRequestSchema, policyDraftRequestSchema, validatePolicyRequestSchema } from "./schemas.js";

const app = new Hono();

app.use("*", cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"], allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "rail-agent",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    robinhoodRpcConfigured: Boolean(process.env.ROBINHOOD_RPC_URL),
    contractsConfigured: railContractsConfigured(),
  }),
);

app.post("/api/policies/draft", async (c) => {
  const parsed = policyDraftRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const result = await draftPolicy(parsed.data);
  return c.json({ ok: true, ...result });
});

app.post("/api/policies/validate", async (c) => {
  const parsed = validatePolicyRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const result = validatePolicy(parsed.data.policy);
  return c.json({ ok: result.ok, errors: result.errors });
});

app.post("/api/agent/simulate", async (c) => {
  const parsed = agentActionRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const result = simulateAction(parsed.data);
  return c.json({ ok: true, status: result.executable ? "executable" : "blocked", ...result });
});

function readableError(error: unknown) {
  if (error && typeof error === "object" && "shortMessage" in error && typeof error.shortMessage === "string") {
    return error.shortMessage.slice(0, 280);
  }
  if (error instanceof Error) {
    return error.message.slice(0, 280);
  }
  return "Agent transaction failed.";
}

app.post("/api/agent/execute", async (c) => {
  const parsed = agentActionRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const simulation = simulateAction(parsed.data);
  let txHash: string | undefined;
  let status: "executed" | "blocked" | "failed" = simulation.executable ? "executed" : "blocked";
  let reason = simulation.reason;
  let transactionStatus: "not-submitted" | "confirmed" | "failed" = simulation.executable ? "confirmed" : "not-submitted";

  if (railContractsConfigured()) {
    try {
      txHash = simulation.executable
        ? await submitAgentExecution(parsed.data)
        : await submitBlockedAction(parsed.data, simulation.reason);
      transactionStatus = "confirmed";
    } catch (error) {
      reason = readableError(error);
      status = "failed";
      transactionStatus = "failed";

      try {
        txHash = await submitBlockedAction(parsed.data, reason);
        status = "blocked";
        transactionStatus = "confirmed";
      } catch {
        // Keep the original failure if the agent cannot emit the blocked proof.
      }
    }
  } else if (simulation.executable) {
    txHash = "0xdemoagentexecution";
  }

  const activity = addActivity(parsed.data.walletAddress, {
    kind: status === "executed" ? "executed" : status === "blocked" ? "blocked" : "failed",
    status: status === "executed" ? "executed" : status === "blocked" ? "blocked" : "failed",
    actionType: parsed.data.action.type,
    title: status === "executed" ? "Executed onchain agent action" : status === "blocked" ? `Blocked: ${simulation.rule}` : "Agent action failed",
    attempted: simulation.attempted,
    reason,
    rule: status === "failed" ? "AgentExecutor transaction" : simulation.rule,
    fundsMoved: status === "executed" ? `${parsed.data.action.amountUSDC} USDC` : "0 USDC",
    policyId: parsed.data.policy.id,
    simulationResult: status === "executed" ? "passed" : status === "blocked" ? "blocked" : "failed",
    transaction: {
      chainId: parsed.data.policy.chainId,
      contractAddress: process.env.AGENT_EXECUTOR_ADDRESS || process.env.VITE_AGENT_EXECUTOR_ADDRESS || parsed.data.policy.contractAddress,
      hash: txHash,
      status: transactionStatus,
    },
    timestamp: "Just now",
    txHash,
  });

  return c.json({
    ok: status !== "failed",
    status,
    simulation,
    activity,
    txHash,
  }, status === "failed" ? 500 : 200);
});

app.get("/api/activity/:wallet", (c) => {
  return c.json({ ok: true, activity: listActivity(c.req.param("wallet")) });
});

const port = Number(process.env.PORT || 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Rail agent service listening on http://localhost:${info.port}`);
});

export default app;
