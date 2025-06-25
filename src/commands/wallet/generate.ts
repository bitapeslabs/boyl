import fs from "fs";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { z } from "zod";
import { getWallet } from "../shared";
import { Command } from "@/commands/base";
import {
  generateWallet,
  getCurrentTaprootAddress,
  switchWallet,
} from "@/crypto/wallet";
import { WALLET_PATH, DEFAULT_ERROR } from "@/consts";

export default class WalletGenerate extends Command {
  static override description = "Generate a new address from your HD wallet";
  static override examples = ["$ boyl wallet generate"];

  public override async run(): Promise<void> {
    const wallet = await getWallet(this, true);

    const walletExists = wallet.status;

    const { password } = await inquirer.prompt<{ password: string }>([
      {
        type: "password",
        name: "password",
        message: walletExists
          ? "Enter your password: "
          : "Choose a wallet password (keep it short & sweet; you'll use it often): ",
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

    if (!walletExists) {
      // Wallet does not exist — generate new
      const spinner = ora("Generating new wallet...").start();
      const result = await generateWallet({ password });

      if (result.status === false) {
        spinner.fail("Failed to generate wallet.");
        this.error(result.message ?? DEFAULT_ERROR);
        return;
      }

      const { mnemonic, signer, walletJson } = result.data;

      await fs.promises.writeFile(
        WALLET_PATH,
        JSON.stringify(walletJson, null, 2),
        {
          flag: "w",
        }
      );

      spinner.succeed("Wallet generated and saved.");
      this.log(chalk.yellow.bold("✓ New Wallet Created!"));
      this.log(`Address: ${chalk.green(getCurrentTaprootAddress(signer))}`);
      this.log(
        `Mnemonic: ${chalk.cyanBright(mnemonic)} ${chalk.gray(
          "(write this down!)"
        )}`
      );
      return;
    }

    // Wallet already exists — switch to next index
    const raw = await fs.promises.readFile(WALLET_PATH, "utf-8");
    const parsed = JSON.parse(raw);

    const newIndex = parsed.generatedIndex + 1;

    const result = switchWallet(parsed, password, newIndex);
    if (result.status === false) {
      this.error(`Failed to generate new address: ${result.message}`);
      return;
    }

    const updatedWalletJson = result.data.walletJson;

    await fs.promises.writeFile(
      WALLET_PATH,
      JSON.stringify(updatedWalletJson, null, 2),
      { flag: "w" }
    );

    this.log(chalk.green("✓ New Wallet Address Generated"));
    this.log(`Index: ${chalk.cyanBright(newIndex)}`);
    this.log(
      `Address: ${chalk.yellow.bold(
        getCurrentTaprootAddress(result.data.signer)
      )}`
    );
  }
}
