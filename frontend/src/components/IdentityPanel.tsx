import { useState } from "react";
import { useOwnedIdentities, useSuiData } from "../hooks/useSuiData";

// Create / show the connected wallet's on-chain Identity. An Identity is
// required before publishing datasets (list_dataset asserts ownership).
export function IdentityPanel() {
  const { createIdentity } = useSuiData();
  const { data: identities, refetch, isLoading } = useOwnedIdentities();
  const [name, setName] = useState("demo-agent");
  const [kind, setKind] = useState<0 | 1>(1); // default Agent
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identity = identities?.[0] ?? null;

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      await createIdentity(kind, name);
      // Give the fullnode a moment to index, then refetch.
      await new Promise((r) => setTimeout(r, 1500));
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <h2>1 · Identity</h2>
      {isLoading ? (
        <p>Loading…</p>
      ) : identity ? (
        <p>
          ✅ <strong>{identity.displayName}</strong>{" "}
          <span style={{ opacity: 0.6 }}>
            ({identity.kind === 1 ? "Agent" : "Human"})
          </span>
          <br />
          <code style={mono}>{identity.id}</code>
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={kind}
            onChange={(e) => setKind(Number(e.target.value) as 0 | 1)}
          >
            <option value={1}>Agent</option>
            <option value={0}>Human</option>
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="display name"
          />
          <button onClick={handleCreate} disabled={busy || !name}>
            {busy ? "Creating…" : "Create identity"}
          </button>
        </div>
      )}
      {error && <p style={errStyle}>{error}</p>}
    </section>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "1rem 1.25rem",
  marginBottom: "1rem",
};
const mono: React.CSSProperties = { fontSize: 12, wordBreak: "break-all" };
const errStyle: React.CSSProperties = { color: "#b91c1c", fontSize: 13 };
