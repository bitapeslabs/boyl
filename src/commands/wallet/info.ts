import chalk from "chalk";
import { Command } from "@/commands/base";
import { getDecryptedWalletFromPassword, getWallet } from "../shared";
import { isBoxedError } from "@/boxed";
import {
  getCurrentTaprootAddress,
  getCurrentTaprootAddressFromWallet,
} from "@/crypto/wallet";

export default class WalletInfo extends Command {
  static override description =
    "Show information about your current wallet address";
  static override examples = ["$ boyl wallet info"];

  public override async run(): Promise<void> {
    const walletResponse = await getWallet(this);

    if (isBoxedError(walletResponse)) {
      this.error(`Failed to fetch wallet: ${walletResponse.message}`);
      return;
    }

    const decryptedWalletResponse = await getDecryptedWalletFromPassword(
      this,
      walletResponse.data
    );

    if (isBoxedError(decryptedWalletResponse)) {
      this.error(
        `Failed to fetch wallet information: ${decryptedWalletResponse.message}`
      );
      return;
    }

    const { signer } = decryptedWalletResponse.data;

    try {
      this.log(
        `Your Address: ${chalk.yellow.bold(getCurrentTaprootAddress(signer))}`
      );
    } catch (err) {
      console.log(err);
      this.error(`Failed to derive address from xpub`);
    }
  }
}
