import chalk from "chalk";
import ora from "ora";
import { Command } from "@/commands/base";
import { DEFAULT_ERROR, CURRENT_BTC_TICKER } from "@/consts";
import {
  decryptWalletWithPassword,
  viewAddresses,
  WalletSigner,
} from "@/crypto/wallet";

import { getDecryptedWalletFromPassword, getWallet } from "../shared";

export default class WalletList extends Command {
  static override description =
    "List all generated wallet addresses and balances";
  static override examples = ["$ boyl wallets"];

  public override async run(): Promise<void> {
    const walletResponse = await getWallet(this);
    if (walletResponse.status === false) {
      this.error(`Failed to fetch wallet: ${walletResponse.message}`);
      return;
    }
    const walletJson = walletResponse.data;

    const decryptedResponse = await getDecryptedWalletFromPassword(
      this,
      walletJson
    );
    if (decryptedResponse.status === false) {
      this.error(`Failed to decrypt wallet: ${decryptedResponse.message}`);
      return;
    }
    const { password } = decryptedResponse.data;

    const currentIndex = walletJson.currentWalletIndex;

    const spinner = ora("Fetching wallet addresses...").start();

    let signer: WalletSigner;
    try {
      const decrypted = decryptWalletWithPassword(
        walletJson.encryptedMnemonic,
        password
      );
      signer = decrypted.signer;
    } catch (err) {
      spinner.fail("Invalid password.");
      this.error("Could not decrypt wallet.");
      return;
    }

    try {
      const balances = await viewAddresses(signer, walletJson);
      spinner.stop();

      this.log(chalk.greenBright("\n✓ Wallets Loaded\n"));
      balances.forEach((entry, i) => {
        const isCurrent = i === currentIndex;
        const indexLabel = isCurrent
          ? chalk.bgCyan.black(` #${i} (current) `)
          : chalk.gray(`#${i}`);

        this.log(
          `${indexLabel} ${chalk.yellow(entry.address)}\n  → ${chalk.cyanBright(
            `${entry.btc_balance} ${CURRENT_BTC_TICKER}`
          )}\n`
        );
      });

      this.log(
        chalk.gray(
          "Type 'wallet switch <index>' to switch to another address.\n"
        )
      );
    } catch (err) {
      spinner.fail("Failed to load wallet addresses.");
      this.error(err instanceof Error ? err.message : DEFAULT_ERROR);
    }
  }
}
