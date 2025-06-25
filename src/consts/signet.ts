import { regtest } from "bitcoinjs-lib/src/networks";
import fs from "fs";
import path from "path";
import envPaths from "env-paths";
import { Provider } from "@/libs/alkanes/provider";

if (!process.env.CONTRACT_WORKING_DIRECTORY || !process.env.CONTRACT_NAME) {
  throw new Error(
    "Environment variables CONTRACT_WORKING_DIRECTORY and CONTRACT_NAME must be set."
  );
}

export const DEFAULT_ERROR = "An unknown error occurred";

export const CONTRACT_WORKING_DIRECTORY =
  process.env.CONTRACT_WORKING_DIRECTORY;
export const CONTRACT_NAME = process.env.CONTRACT_NAME;
export const ELECTRUM_API_URL = "https://boylnet.mezcal.sh/esplora";
export const EXPLORER_URL = "https://boylnet.mezcal.sh";
export const CURRENT_BTC_TICKER = "rBTC";
export const NETWORK = regtest; // Signet uses the testnet network configuration

if (!process.env.MNEMONIC_PASSWORD) {
  throw new Error("Environment variable MNEMONIC_PASSWORD must be set.");
}

export const MNEMONIC_PASSWORD = process.env.MNEMONIC_PASSWORD;

//paths
const paths = envPaths("boyl");

fs.mkdirSync(paths.data, { recursive: true });
export const WALLET_PATH = path.resolve(paths.data, "wallet.json");

export const getChosenWallet = () => {
  if (!fs.existsSync(WALLET_PATH)) {
    return 0;
  }
  const walletJson = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
  return walletJson.currentWalletIndex;
};
export let CHOSEN_WALLET = getChosenWallet();

export const setChosenWallet = (wallet: number) => {
  CHOSEN_WALLET = wallet;
};

export const ALKANES_PROVIDER = new Provider({
  url: "https://boylnet.mezcal.sh/sandshrew",
  projectId: "",
  version: "",
  network: NETWORK,
  networkType: "regtest",
});
