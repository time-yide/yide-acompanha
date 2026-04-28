import { calculateCommission } from "./calculator";

export async function previewMyCommission(userId: string) {
  const now = new Date();
  const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const result = await calculateCommission(userId, monthRef);
  return { monthRef, result };
}
