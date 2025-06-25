import { Command } from "@/commands/base";
import { contractDeployment } from "@/libs/alkanes/contract";
import { z } from "zod";

import { getDecryptedWalletFromPassword, getWallet } from "../shared";
import {
  getOylAccountFromSigner,
  getOylSignerFromWalletSigner,
} from "@/crypto/oyl";
import {
  esploraUtxosToFormattedUtxos,
  getAlkanesDeploymentParamsFromWasmPath,
} from "@/libs/alkanes";
import { ALKANES_PROVIDER, EXPLORER_URL } from "@/consts";
import { consumeOrThrow } from "@/boxed";
import { esplora_broadcastTx, esplora_getutxos } from "@/apis/esplora";
import { getCurrentTaprootAddress } from "@/crypto/wallet";
import chalk from "chalk";
const filePathSchema = z.string().refine(
  (val) => {
    // reject empty / whitespace
    if (!val.trim()) return false;

    // 1️⃣ split out an optional drive prefix (Windows)
    let rest = val;
    const drive = /^[a-zA-Z]:/;
    if (drive.test(val)) {
      rest = val.slice(2); // keep everything after `C:`
    }

    // 2️⃣ ensure no additional colons and no forbidden chars
    const illegal = /[<>:"|?*\x00-\x1F]/;
    if (illegal.test(rest)) return false;
    if ((rest.match(/:/g) || []).length) return false; // extra `:`

    // 3️⃣ quick sanity: no NULL-byte segments, no empty segments like `\\`
    if (rest.split(/[/\\]/).some((seg) => seg === "")) return false;

    return true;
  },
  { message: "Invalid file path" }
);
export class Deploy extends Command {
  static override description = "Deploy an alkanes smart contract";
  static override examples = ["$ boyl deploy <path/to/wasm>"];

  public override async run(args: string[]): Promise<void> {
    try {
      let wasmPath: string;
      if (args.length > 0) {
        wasmPath = args[0];
      } else {
        this.error("Please provide the path to the wasm file.");
        return;
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
      const { password, signer } = decryptedResponse.data;

      const address = await getCurrentTaprootAddress(signer);

      const oylAccount = getOylAccountFromSigner(signer);
      const oylSigner = getOylSignerFromWalletSigner(signer);
      const { payload, protostone } =
        await getAlkanesDeploymentParamsFromWasmPath(wasmPath);

      const utxos = consumeOrThrow(await esplora_getutxos(address));

      const formattedUtxos = consumeOrThrow(
        await esploraUtxosToFormattedUtxos(utxos)
      );

      const gatheredUtxos = {
        utxos: formattedUtxos,
        totalAmount: utxos.reduce((sum, utxo) => sum + utxo.value, 0),
      };

      const { rawTx } = await contractDeployment({
        signer: oylSigner,
        account: oylAccount,
        payload,
        protostone: Buffer.from(protostone),
        utxos: gatheredUtxos.utxos,
        provider: ALKANES_PROVIDER,
        feeRate: 10,
      });

      const txid = consumeOrThrow(await esplora_broadcastTx(rawTx));

      console.log(chalk.greenBright("\n✓ Contract Deployed\n"));
      console.log(chalk.gray(`Transaction: ${EXPLORER_URL}/tx/${txid}`));
    } catch (err) {
      this.error(
        `Failed to deploy contract: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  }
}
export default Deploy;
