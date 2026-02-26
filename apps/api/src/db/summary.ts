import type { SummaryResponse } from "@pennywise/contracts";
import { eq, sql } from "drizzle-orm";

import type { ApiDatabase } from "./client.js";
import { transactions } from "./schema.js";

export async function getPersistedSummary(
  database: ApiDatabase,
  userId: string,
): Promise<SummaryResponse> {
  const [result] = await database
    .select({
      totalIncomeCents: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountCents} else 0 end), 0)`,
      totalExpenseCents: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  const totalIncomeCents = Number(result?.totalIncomeCents ?? 0);
  const totalExpenseCents = Number(result?.totalExpenseCents ?? 0);

  return {
    totalIncomeCents,
    totalExpenseCents,
    balanceCents: totalIncomeCents - totalExpenseCents,
    currency: "HKD",
  };
}
