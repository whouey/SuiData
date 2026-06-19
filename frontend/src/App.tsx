import { useCurrentAccount } from "@mysten/dapp-kit";
import { Login } from "./components/Login";
import { SellerFlow } from "./components/SellerFlow";
import { ScanReceipt } from "./components/ScanReceipt";

// Mobile seller app: sign in with Google (zkLogin) → scan a receipt → encrypt +
// upload + list → watch the agent buy it. See CLAUDE.md / DEMO_RUNBOOK.md.
function App() {
  const account = useCurrentAccount();

  // Dev-only screen previews (no wallet needed): /?preview=scan
  if (import.meta.env.DEV) {
    const preview = new URLSearchParams(window.location.search).get("preview");
    if (preview === "scan")
      return (
        <div className="app">
          <ScanReceipt onResult={(r) => console.log("scanned", r)} />
        </div>
      );
  }

  return account ? <SellerFlow /> : <Login />;
}

export default App;
