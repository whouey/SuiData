// Client side of the Enoki sponsored-transaction flow. The zkLogin user signs,
// but the server (api/sponsor.ts, secret key) pays the gas — so the user never
// holds SUI. See DEMO_RUNBOOK.md for the Enoki setup.

import { useCurrentAccount, useSignTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";

/** Endpoint of the server sponsor (same-origin /api/sponsor by default). */
const SPONSOR_URL =
  (import.meta.env.VITE_SPONSOR_URL as string | undefined) || "/api/sponsor";

async function callSponsor<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(SPONSOR_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `sponsor ${res.status}`);
  return json as T;
}

/**
 * Returns a function that runs `tx` as an Enoki-sponsored transaction:
 * build kind bytes → server creates the sponsored tx → user signs → server
 * executes. Resolves to `{ digest }` (same shape the UI uses elsewhere).
 */
export function useSponsoredExecutor() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();

  return async function executeSponsored(
    tx: Transaction,
  ): Promise<{ digest: string }> {
    if (!account) throw new Error("not signed in");
    tx.setSender(account.address);
    const kindBytes = await tx.build({ client, onlyTransactionKind: true });

    const created = await callSponsor<{ bytes: string; digest: string }>({
      action: "create",
      transactionKindBytes: toBase64(kindBytes),
      sender: account.address,
    });

    // User signs the sponsored bytes (gas belongs to the sponsor).
    const { signature } = await signTransaction({
      transaction: Transaction.from(created.bytes),
    });

    const executed = await callSponsor<{ digest: string }>({
      action: "execute",
      digest: created.digest,
      signature,
    });

    await client.waitForTransaction({ digest: executed.digest });
    return { digest: executed.digest };
  };
}
