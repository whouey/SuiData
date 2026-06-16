import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { IdentityPanel } from "./components/IdentityPanel";
import { PublishForm } from "./components/PublishForm";
import { Marketplace } from "./components/Marketplace";
import { useOwnedIdentities } from "./hooks/useSuiData";
import "./App.css";

// SuiData demo shell: identity → publish (encrypt+Walrus+list) → browse/buy →
// decrypt+read. See CLAUDE.md for the design.
function App() {
  const account = useCurrentAccount();
  const { data: identities } = useOwnedIdentities();
  const identityId = identities?.[0]?.id ?? null;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>SuiData</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>
            Decentralized identity + data marketplace on Sui
          </p>
        </div>
        <ConnectButton />
      </header>

      {account ? (
        <>
          <IdentityPanel />
          <PublishForm identityId={identityId} />
          <Marketplace />
        </>
      ) : (
        <p>Connect a Sui wallet to begin.</p>
      )}
    </main>
  );
}

export default App;
