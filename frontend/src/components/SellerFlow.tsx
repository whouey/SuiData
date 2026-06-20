// The mobile seller wizard: scan → publish (encrypt+upload+list) → proof.
// Identity is created silently on first sign-in; gas is sponsored (Enoki), so
// the user never touches SUI.

import { useEffect, useRef, useState } from "react";
import {
  useCurrentAccount,
  useDisconnectWallet,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOwnedIdentities,
  usePurchaseProof,
  useOtterProof,
} from "../hooks/useOtterProof";
import {
  encryptDataset,
  generatePolicyId,
  makeSealClient,
} from "../lib/seal";
import { uploadBlob } from "../lib/walrus";
import { toDataset, type Receipt } from "../lib/receipt";
import { EXPLORER } from "../lib/network";
import { ScanReceipt } from "./ScanReceipt";

const SUI = 1_000_000_000;
const PRICE = BigInt(SUI / 20); // 0.05 SUI

type Step = "scan" | "publishing" | "proof";

export function SellerFlow() {
  const account = useCurrentAccount()!;
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();
  const { mutate: disconnect } = useDisconnectWallet();
  const { createIdentity, listDataset } = useOtterProof();
  const { data: identities, refetch: refetchIdentities } = useOwnedIdentities();

  const [step, setStep] = useState<Step>("scan");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [datasetId, setDatasetId] = useState<string | null>(null);

  // Silently ensure a seller Identity exists (sponsored, invisible to the user).
  const ensuring = useRef(false);
  const identityId = identities?.[0]?.id ?? null;
  useEffect(() => {
    if (identityId || ensuring.current || !identities) return;
    ensuring.current = true;
    (async () => {
      try {
        await createIdentity(0, "receipt-seller"); // 0 = Human
        await new Promise((r) => setTimeout(r, 1200));
        await refetchIdentities();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        ensuring.current = false;
      }
    })();
  }, [identityId, identities, createIdentity, refetchIdentities]);

  async function handlePublish(r: Receipt) {
    setReceipt(r);
    setStep("publishing");
    setError(null);
    try {
      if (!identityId) {
        setStatus("Finishing account setup…");
        await refetchIdentities();
      }
      const id = identities?.[0]?.id;
      if (!id) throw new Error("identity not ready — try again in a moment");

      const ds = toDataset(r);
      setStatus("Encrypting your receipt (Seal)…");
      const seal = makeSealClient(suiClient);
      const policy = generatePolicyId();
      const plaintext = new TextEncoder().encode(JSON.stringify(ds.payload));
      const ciphertext = await encryptDataset(seal, policy.hex, plaintext);

      setStatus("Uploading to Walrus…");
      const blobId = await uploadBlob(ciphertext);

      setStatus("Listing on-chain (gas sponsored)…");
      const res = await listDataset({
        identityId: id,
        title: ds.title,
        description: ds.description,
        category: ds.category,
        preview: ds.preview,
        price: PRICE,
        walrusBlobId: blobId,
        sealPolicyId: policy.bytes,
      });

      setStatus("Confirming…");
      await suiClient.waitForTransaction({ digest: res.digest });
      const created = await findCreatedDataset(suiClient, res.digest);
      setDatasetId(created);
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      setStep("proof");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("scan");
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar__brand">◈ OtterProof</span>
        <button className="link" onClick={() => disconnect()}>
          {account.address.slice(0, 6)}…{account.address.slice(-4)} · sign out
        </button>
      </header>

      <Stepper step={step} />

      {step === "scan" && <ScanReceipt onResult={handlePublish} />}

      {step === "publishing" && (
        <div className="screen screen--center">
          <div className="spinner" />
          <p className="status">{status}</p>
          {error && <p className="err">{error}</p>}
        </div>
      )}

      {step === "proof" && datasetId && receipt && (
        <ProofView
          datasetId={datasetId}
          receipt={receipt}
          onAgain={() => {
            setDatasetId(null);
            setReceipt(null);
            setStep("scan");
          }}
        />
      )}

      {step === "scan" && error && (
        <p className="err" style={{ textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["scan", "publishing", "proof"];
  const labels = { scan: "Scan", publishing: "List", proof: "Proof" };
  const idx = order.indexOf(step);
  return (
    <div className="stepper">
      {order.map((s, i) => (
        <div
          key={s}
          className={`stepper__dot ${i <= idx ? "is-active" : ""}`}
          aria-label={labels[s]}
        >
          <span>{i + 1}</span>
          <em>{labels[s]}</em>
        </div>
      ))}
    </div>
  );
}

function ProofView({
  datasetId,
  receipt,
  onAgain,
}: {
  datasetId: string;
  receipt: Receipt;
  onAgain: () => void;
}) {
  const { data: proof } = usePurchaseProof(datasetId);
  const sold = (proof?.salesCount ?? 0) > 0;
  const ds = toDataset(receipt);

  return (
    <div className="screen">
      <div className="card listing">
        <div className="listing__head">
          <strong>{ds.title}</strong>
          <span className="price">{Number(PRICE) / SUI} SUI</span>
        </div>
        <p className="preview">{ds.preview}</p>
        <p className="rep">
          ⭐ {proof?.salesCount ?? 0} sales · this listing live on-chain
        </p>
      </div>

      {!sold ? (
        <div className="card waiting">
          <div className="pulse" />
          <p>Listed! Waiting for an agent to buy…</p>
          <p className="muted tiny">
            Run <code>npm run agent</code> on the laptop.
          </p>
        </div>
      ) : (
        <div className="card paid">
          <p className="paid__amt">
            ✅ Payment received +{Number(proof!.lastSale?.price ?? PRICE) / SUI}{" "}
            SUI
          </p>
          <p className="muted">sales_count is now {proof!.salesCount}.</p>
          {proof!.lastSale && (
            <a
              className="link"
              href={`${EXPLORER}/tx/${proof!.lastSale.txDigest}`}
              target="_blank"
              rel="noreferrer"
            >
              View payment on explorer ↗
            </a>
          )}
        </div>
      )}

      <button className="btn btn--ghost" onClick={onAgain}>
        Scan another receipt
      </button>
    </div>
  );
}

/** Find the Dataset object created by a list_dataset tx. */
async function findCreatedDataset(
  client: ReturnType<typeof useSuiClient>,
  digest: string,
): Promise<string> {
  const tx = await client.getTransactionBlock({
    digest,
    options: { showObjectChanges: true },
  });
  const created = tx.objectChanges?.find(
    (c) => c.type === "created" && c.objectType.endsWith("::marketplace::Dataset"),
  );
  if (!created || created.type !== "created")
    throw new Error("listing succeeded but Dataset id not found");
  return created.objectId;
}
