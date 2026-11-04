// Verify only successful, finalized native SOL system transfers to this recipient.
// This proves a transfer, not that the account submitting its signature paid it.
export function verifiedLamports(
  transaction: unknown,
  recipient: string,
): number {
  if (!transaction || typeof transaction !== "object")
    throw new Error("Transaction not found.");
  const tx = transaction as {
    meta?: { err: unknown };
    blockTime?: unknown;
    transaction?: { message?: { instructions?: unknown[] } };
  };
  if (!tx.meta || tx.meta.err !== null || !Number.isInteger(tx.blockTime))
    throw new Error("Transfer has not succeeded.");
  let total = 0;
  for (const raw of tx.transaction?.message?.instructions ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const i = raw as {
      program?: string;
      programId?: string;
      parsed?: {
        type?: string;
        info?: { destination?: string; lamports?: unknown };
      };
    };
    if (
      i.program !== "system" ||
      i.programId !== "11111111111111111111111111111111" ||
      i.parsed?.type !== "transfer" ||
      i.parsed.info?.destination !== recipient
    )
      continue;
    const amount = i.parsed.info.lamports;
    if (
      typeof amount !== "number" ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    )
      throw new Error("Invalid transfer amount.");
    total += amount;
    if (!Number.isSafeInteger(total))
      throw new Error("Transfer amount is too large.");
  }
  if (total === 0)
    throw new Error(
      "No native SOL transfer to this campaign recipient was found.",
    );
  return total;
}
