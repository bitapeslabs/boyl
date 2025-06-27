import fs from "fs";
import { z } from "zod";
import inquirer from "inquirer";
import path from "path";
import chalk from "chalk";

import { Command } from "@/commands/base";
import {
  getCurrentTaprootAddress,
  generateWallet,
  isValidMnemonic,
} from "@/crypto/wallet";
import { WALLET_PATH } from "@/consts";

export default class WalletRecover extends Command {
  static override description = "Recover a wallet from a mnemonic phrase";
  static override examples = ["$ boyl wallet recover"];

  public override async run(
    args: string[],
    opts: Record<string, unknown>
  ): Promise<void> {
    const target = WALLET_PATH;

    if (fs.existsSync(target)) {
      this.error(
        `You already have a wallet at ${target}. Delete it manually if you want to overwrite it.`
      );
      return;
    }

    // Step 1: Prompt for mnemonic
    const { mnemonic } = await inquirer.prompt<{ mnemonic: string }>([
      {
        type: "input",
        name: "mnemonic",
        message: "Enter your 12-word mnemonic phrase:",
        validate: async (input: string) => {
          const words = input.trim().split(/\s+/);
          if (words.length !== 12) return "Mnemonic must be exactly 12 words";
          const isValid = await isValidMnemonic(input);
          return isValid || "Invalid mnemonic phrase";
        },
      },
    ]);

    // Step 2: Prompt for password
    const { password } = await inquirer.prompt<{ password: string }>([
      {
        type: "password",
        name: "password",
        message:
          "Set a wallet password (keep it short & sweet; you'll use it often)",
        mask: "*",
        validate: (input: string) => {
          const PasswordSchema = z
            .string()
            .min(4, "too short – min 4 chars")
            .max(32, "too long – max 32 chars")
            .regex(/^\S+$/, "no spaces allowed");
          const result = PasswordSchema.safeParse(input);
          return result.success ? true : result.error.issues[0].message;
        },
      },
    ]);

    // Step 3: Generate wallet from mnemonic
    const walletResponse = await generateWallet({
      from_mnemonic: mnemonic,
      password,
    });

    if (walletResponse.status === false) {
      this.error(`Failed to recover wallet: ${walletResponse.errorType}`);
      return;
    }

    const { walletJson, signer } = walletResponse.data;

    try {
      await fs.promises.writeFile(target, JSON.stringify(walletJson, null, 2), {
        flag: "w",
      });
    } catch (err: unknown) {
      this.error(`Failed to write wallet file: ${(err as Error).message}`);
      return;
    }

    // Step 4: Show success output
    this.log(chalk.green(`✓ Wallet recovered and saved to ${target}`));
    this.log(
      `Your Address: ${chalk.yellow.bold(getCurrentTaprootAddress(signer))}`
    );
    this.log(
      chalk.gray(
        "You can reprint your mnemonic any time with `boyl wallet show`"
      )
    );
  }
}
