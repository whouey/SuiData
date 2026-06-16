import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSuiData } from "../hooks/useSuiData";
import {
  encryptDataset,
  generatePolicyId,
  makeSealClient,
} from "../lib/seal";
import { uploadBlob } from "../lib/walrus";

const SUI = 1_000_000_000;

// Publish flow: generate a Seal policy id -> encrypt the survey client-side ->
// upload ciphertext to Walrus -> list_dataset on-chain with the blob id + policy
// id. Requires the wallet to own an Identity.
export function PublishForm({ identityId }: { identityId: string | null }) {
  const suiClient = useSuiClient();
  const { listDataset } = useSuiData();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("Q2 2026 Agentic Web Market Survey");
  const [description, setDescription] = useState(
    "Survey of 1,200 autonomous agents on data-purchasing behavior.",
  );
  const [category, setCategory] = useState("market-survey");
  const [priceSui, setPriceSui] = useState("0.1");
  const [content, setContent] = useState(
    "FINDING: 73% of agents would pay for verified, structured market data.",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handlePublish() {
    if (!identityId) return;
    setBusy(true);
    setError(null);
    try {
      const policy = generatePolicyId();

      setStatus("Encrypting (Seal)…");
      const seal = makeSealClient(suiClient);
      const plaintext = new TextEncoder().encode(content);
      const ciphertext = await encryptDataset(seal, policy.hex, plaintext);

      setStatus("Uploading ciphertext to Walrus…");
      const blobId = await uploadBlob(ciphertext);

      setStatus("Listing dataset on-chain…");
      await listDataset({
        identityId,
        title,
        description,
        category,
        price: BigInt(Math.round(Number(priceSui) * SUI)),
        walrusBlobId: blobId,
        sealPolicyId: policy.bytes,
      });

      setStatus("✅ Published!");
      await new Promise((r) => setTimeout(r, 1500));
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <h2>2 · Publish a dataset</h2>
      {!identityId ? (
        <p style={{ opacity: 0.6 }}>Create an identity first.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={2}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              style={{ flex: 1 }}
            />
            <input
              value={priceSui}
              onChange={(e) => setPriceSui(e.target.value)}
              placeholder="Price (SUI)"
              type="number"
              step="0.01"
              style={{ width: 120 }}
            />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Dataset contents (encrypted before upload)"
            rows={3}
          />
          <button onClick={handlePublish} disabled={busy}>
            {busy ? "Working…" : "Encrypt, upload & list"}
          </button>
          {status && <p style={{ fontSize: 13 }}>{status}</p>}
          {error && <p style={errStyle}>{error}</p>}
        </div>
      )}
    </section>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "1rem 1.25rem",
  marginBottom: "1rem",
};
const errStyle: React.CSSProperties = { color: "#b91c1c", fontSize: 13 };
