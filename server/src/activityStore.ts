type ActivityRecord = Record<string, unknown> & { id: string; walletAddress?: string; createdAt: string };

const activityByWallet = new Map<string, ActivityRecord[]>();

export function addActivity(walletAddress: string | undefined, activity: Omit<ActivityRecord, "id" | "walletAddress" | "createdAt">) {
  const key = walletAddress?.toLowerCase() || "demo";
  const record: ActivityRecord = {
    id: `server-event-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    walletAddress,
    createdAt: new Date().toISOString(),
    ...activity,
  };
  activityByWallet.set(key, [record, ...(activityByWallet.get(key) || [])]);
  return record;
}

export function listActivity(walletAddress: string) {
  return activityByWallet.get(walletAddress.toLowerCase()) || activityByWallet.get("demo") || [];
}
