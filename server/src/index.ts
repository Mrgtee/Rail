import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { addActivity, listActivity } from "./activityStore.js";
import { simulateAction, validatePolicy } from "./agent.js";
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
    contractsConfigured: Boolean(process.env.POLICY_VAULT_ADDRESS && process.env.AGENT_EXECUTOR_ADDRESS),
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

app.post("/api/agent/execute", async (c) => {
  const parsed = agentActionRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  const simulation = simulateAction(parsed.data);
  const activity = addActivity(parsed.data.walletAddress, {
    kind: simulation.executable ? "executed" : "blocked",
    title: simulation.executable ? "Executed demo action" : `Blocked: ${simulation.rule}`,
    attempted: simulation.attempted,
    reason: simulation.reason,
    rule: simulation.rule,
    fundsMoved: simulation.executable ? `${parsed.data.action.amountUSDC} USDC` : "0 USDC",
    policyId: parsed.data.policy.id,
  });

  return c.json({
    ok: true,
    status: simulation.executable ? "executed" : "blocked",
    simulation,
    activity,
    txHash: simulation.executable ? "0xdemoagentexecution" : undefined,
  });
});

app.get("/api/activity/:wallet", (c) => {
  return c.json({ ok: true, activity: listActivity(c.req.param("wallet")) });
});

const port = Number(process.env.PORT || 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Rail agent service listening on http://localhost:${info.port}`);
});

export default app;
