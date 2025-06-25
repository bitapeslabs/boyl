import WalletGenerate from "./wallet/generate";
import WalletRecover from "./wallet/recover";
import WalletShowSeed from "./wallet/reveal";
import Wallets from "./wallets/index";
import WalletShowAddress from "./wallet/info";
import WalletSwitch from "./wallet/switch";
import { Deploy } from "./deploy";
import { Command } from "./base";

export const commands: Record<string, typeof Command> = {
  wallets: Wallets,

  "wallet:switch": WalletSwitch,
  "wallet:generate": WalletGenerate,
  "wallet:recover": WalletRecover,
  "wallet:reveal": WalletShowSeed,
  "wallet:info": WalletShowAddress,
  deploy: Deploy,
};

export default commands;
