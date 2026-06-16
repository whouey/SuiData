import { useState } from "react";
import {
  useCurrentAccount,
  useSignPersonalMessage,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDatasets,
  useOwnedGrants,
  useSuiData,
  type Dataset,
} from "../hooks/useSuiData";
import {
  buildApproveTxBytes,
  decryptDataset,
  makeSealClient,
  makeSessionKey,
} from "../lib/seal";
import { downloadBlob } from "../lib/walrus";
import { card, errStyle } from "./ui";

const SUI = 1_000_000_000;

// Browse listed datasets; buy access; decrypt + read the ones you've bought.
export function Marketplace() {
  const { data: datasets, isLoading } = useDatasets();
  const { data: grants } = useOwnedGrants();

  return (
    <section style={card}>
      <h2>3 · Marketplace</h2>
      {isLoading ? (
        <p>Loading datasets…</p>
      ) : !datasets || datasets.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No datasets listed yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {datasets.map((d) => (
            <DatasetCard key={d.id} dataset={d} grantId={grants?.[d.id]} />
          ))}
        </div>
      )}
    </section>
  );
}

function DatasetCard({
  dataset,
  grantId,
}: {
  dataset: Dataset;
  grantId?: string;
}) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { purchase } = useSuiData();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const queryClient = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);

  const owned = !!grantId;
  const isPublisher = account?.address === dataset.publisher;

  async function handleBuy() {
    setBusy(true);
    setError(null);
    try {
      setStatus("Purchasing…");
      await purchase(dataset.id, dataset.price);
      await new Promise((r) => setTimeout(r, 1500));
      queryClient.invalidateQueries(); // refresh grants
      setStatus("✅ Purchased — you can decrypt now.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleDecrypt() {
    if (!grantId || !account) return;
    setBusy(true);
    setError(null);
    try {
      setStatus("Downloading ciphertext…");
      const ciphertext = await downloadBlob(dataset.walrusBlobId);

      setStatus("Authorizing decryption (sign in wallet)…");
      const seal = makeSealClient(suiClient);
      const sessionKey = await makeSessionKey(suiClient, account.address);
      const { signature } = await signPersonalMessage({
        message: sessionKey.getPersonalMessage(),
      });
      await sessionKey.setPersonalMessageSignature(signature);

      const txBytes = await buildApproveTxBytes(
        suiClient,
        dataset.sealPolicyIdHex,
        grantId,
        dataset.id,
      );

      setStatus("Decrypting…");
      const bytes = await decryptDataset(seal, sessionKey, txBytes, ciphertext);
      setPlaintext(new TextDecoder().decode(bytes));
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={item}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong>{dataset.title}</strong>
        <span>{Number(dataset.price) / SUI} SUI</span>
      </div>
      <p style={{ margin: "4px 0", fontSize: 14 }}>{dataset.description}</p>
      {dataset.preview && (
        <p style={previewStyle}>
          <span style={{ opacity: 0.6 }}>Preview · </span>
          {dataset.preview}
        </p>
      )}
      <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
        {dataset.category} · by{" "}
        <code>
          {dataset.publisher.slice(0, 8)}…{dataset.publisher.slice(-4)}
        </code>
        {isPublisher && " (you)"}
      </p>

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        {!owned ? (
          <button onClick={handleBuy} disabled={busy || !account}>
            {busy ? "…" : `Buy access (${Number(dataset.price) / SUI} SUI)`}
          </button>
        ) : (
          <button onClick={handleDecrypt} disabled={busy}>
            {busy ? "…" : "Decrypt & read"}
          </button>
        )}
        {owned && (
          <span style={{ fontSize: 12, color: "#16a34a", alignSelf: "center" }}>
            ✅ access granted
          </span>
        )}
      </div>

      {status && <p style={{ fontSize: 13 }}>{status}</p>}
      {error && <p style={errStyle}>{error}</p>}
      {plaintext !== null && (
        <pre style={pre}>{plaintext}</pre>
      )}
    </div>
  );
}

const previewStyle: React.CSSProperties = {
  margin: "4px 0",
  fontSize: 13,
  padding: "6px 8px",
  background: "#f1f5f9",
  borderRadius: 6,
  borderLeft: "3px solid #cbd5e1",
};
const item: React.CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 10,
  padding: "0.75rem 1rem",
  background: "#fafafa",
};
const pre: React.CSSProperties = {
  marginTop: 8,
  padding: 10,
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 8,
  whiteSpace: "pre-wrap",
  fontSize: 13,
};
