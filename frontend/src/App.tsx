import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { PACKAGE_ID } from "./lib/network";
import "./App.css";

// Scaffold shell for the SuiData dapp. The demo flow (create identity → list a
// dataset → purchase → decrypt + read) gets wired up in later sessions via
// useSuiData(), lib/walrus.ts, and lib/seal.ts. See CLAUDE.md.
function App() {
  const account = useCurrentAccount();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>SuiData</h1>
        <ConnectButton />
      </header>

      <p>Decentralized identity + data marketplace on Sui.</p>

      {account ? (
        <section>
          <p>
            Connected as <code>{account.address}</code>
          </p>
          <ol>
            <li>Create an on-chain identity (TODO)</li>
            <li>Publish an encrypted dataset to Walrus (TODO)</li>
            <li>Buy access with SUI (TODO)</li>
            <li>Decrypt &amp; read via Seal (TODO)</li>
          </ol>
        </section>
      ) : (
        <p>Connect a Sui wallet to begin.</p>
      )}

      {PACKAGE_ID === "0x0" && (
        <p style={{ color: "#b45309" }}>
          ⚠️ Move package not yet published — set <code>VITE_PACKAGE_ID</code>.
        </p>
      )}
    </main>
  );
}

export default App;
