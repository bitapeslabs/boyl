import chalk from "chalk";
import ora from "ora";

import { Command } from "@/commands/base";
import { CURRENT_BTC_TICKER } from "@/consts";
import { esplora_getaddressbalance } from "@/apis/esplora";
import { isBoxedError } from "@/boxed";
import { getDecryptedWalletFromPassword, getWallet } from "../shared";
import { getCurrentTaprootAddress } from "@/crypto/wallet";
export default class Balance extends Command {
  static override description = `Show the confirmed ${CURRENT_BTC_TICKER} and Alkanes balances of your wallet address`;
  static override examples = ["$ boyl balance"];

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
    const { password, signer } = decryptedResponse.data;

    const address = getCurrentTaprootAddress(signer);

    try {
      this.log(chalk.gray(`Current address:  ${chalk.gray(address)}\n`));

      const spinner = ora("Fetching balances...").start();

      const [btcResult] = await Promise.all([
        esplora_getaddressbalance(address),
      ]);

      spinner.stop();

      if (isBoxedError(btcResult)) {
        this.error(
          `Failed to fetch ${CURRENT_BTC_TICKER} balance: ${btcResult.message}`
        );
        return;
      }

      const btc = btcResult.data;
      this.log(chalk.yellow.bold(`${CURRENT_BTC_TICKER} Balance:`));
      this.log(`  ${chalk.yellow.bold(`${btc} ${CURRENT_BTC_TICKER}`)}\n`);
    } catch (err) {
      console.error(err);
    }
  }
}
