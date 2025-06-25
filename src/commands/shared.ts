import { Command } from "./base";
import fs from "fs";
import { WALLET_PATH } from "@/consts";
import { DecryptedWallet, SavedWallet } from "@/crypto/wallet";
import inquirer from "inquirer";
import { BoxedError, BoxedSuccess, BoxedResponse } from "@/boxed";
import { isValidMnemonic, decryptWalletWithPassword } from "@/crypto/wallet";
import chalk from "chalk";
import { z } from "zod";

enum SharedCommandErrors {
  NoWalletFound = "No wallet found at the specified path.",
  WalletFileCorrupted = "Failed to parse wallet file – corrupted or invalid format.",
  NoEncryptedMnemonic = "No encrypted mnemonic found in wallet file.",
  DecryptionFailed = "Decryption succeeded but the result is not a valid mnemonic.",
}

export const getWallet = async (
  command: Command,
  ignoreErrors?: boolean
): Promise<BoxedResponse<SavedWallet, SharedCommandErrors>> => {
  const target = WALLET_PATH;

  if (!fs.existsSync(target)) {
    if (!ignoreErrors) {
      command.error(
        `No wallet found at ${target}\n` +
          chalk.gray(`You can create one with: mezcal wallet generate`)
      );
    }
    return new BoxedError(SharedCommandErrors.NoWalletFound);
  }
  const walletFile = await fs.promises.readFile(target, "utf8");
  let parsed: SavedWallet;

  try {
    parsed = JSON.parse(walletFile);
  } catch {
    command.error("Failed to parse wallet file – corrupted or invalid format");
    return new BoxedError(SharedCommandErrors.WalletFileCorrupted);
  }

  if (!parsed.encryptedMnemonic) {
    command.error("No encrypted mnemonic found in wallet file.");
    return new BoxedError(SharedCommandErrors.NoEncryptedMnemonic);
  }

  return new BoxedSuccess(parsed);
};

export const getDecryptedWalletFromPassword = async (
  command: Command,
  wallet: SavedWallet
): Promise<
  BoxedResponse<DecryptedWallet & { password: string }, SharedCommandErrors>
> => {
  const { password } = await inquirer.prompt<{ password: string }>([
    {
      type: "password",
      name: "password",
      message: "Enter your wallet password:",
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

  try {
    const decrypted = decryptWalletWithPassword(
      wallet.encryptedMnemonic,
      password
    );

    const valid = await isValidMnemonic(decrypted.mnemonic);
    if (!valid) {
      command.error(
        "Decryption succeeded but the result is not a valid mnemonic"
      );
      return new BoxedError(SharedCommandErrors.DecryptionFailed);
    }
    return new BoxedSuccess({ ...decrypted, password });
  } catch (err: unknown) {
    command.error("Failed to decrypt wallet. Please check your password.");
    return new BoxedError(SharedCommandErrors.DecryptionFailed);
  }
};
