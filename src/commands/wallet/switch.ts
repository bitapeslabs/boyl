import fs from "fs";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { z } from "zod";
import { getDecryptedWalletFromPassword, getWallet } from "../shared";
import { Command } from "@/commands/base";
import { WALLET_PATH, DEFAULT_ERROR } from "@/consts";
import {
  getCurrentTaprootAddress,
  getCurrentTaprootAddressFromWallet,
  SavedWallet,
  switchWallet,
} from "@/crypto/wallet";

export default class WalletSwitch extends Command {
  static override description = "Switch to another index in your HD wallet";
  static override examples = ["$ boyl wallet switch 2"];

  public override async run(args: string[]): Promise<void> {
    let index: number | undefined = undefined;
    if (args.length > 0) {
      const parsedIndex = parseInt(args[0], 10);
      if (isNaN(parsedIndex)) {
        this.error("Invalid index. Must be a number.");
        return;
      }
      index = parsedIndex;
    }

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
    const { signer, password } = decryptedResponse.data;

    // If index wasn't passed as argument, ask interactively
    if (index === undefined) {
      const answer = await inquirer.prompt<{ index: number }>([
        {
          type: "number",
          name: "index",
          message: `Enter wallet index to switch to (0 - ${walletJson.generatedIndex}):`,
          validate: (value) =>
            value && (value < 0 || value > walletJson.generatedIndex)
              ? `Index out of bounds. Valid range: 0 - ${walletJson.generatedIndex}`
              : true,
        },
      ]);
      index = answer.index;
    } else {
      // If index was passed, validate it
      if (index < 0 || index > walletJson.generatedIndex) {
        this.error(
          `Index ${index} out of bounds. Valid range: 0 - ${walletJson.generatedIndex}`
        );
        return;
      }
    }

    const spinner = ora(`Switching to wallet index ${index}...`).start();

    const result = switchWallet(walletJson, password, index);
    if (result.status === false) {
      spinner.fail("Failed to switch wallet.");
      this.error(result.message ?? DEFAULT_ERROR);
      return;
    }

    const updated = result.data;

    await fs.promises.writeFile(
      WALLET_PATH,
      JSON.stringify(updated.walletJson, null, 2),
      { flag: "w" }
    );

    spinner.succeed("Switched wallet index.");
    this.log(chalk.green(`✓ Now using wallet index ${chalk.cyan(index)}`));
    this.log(`Address: ${chalk.yellow.bold(getCurrentTaprootAddress(signer))}`);
  }
}
