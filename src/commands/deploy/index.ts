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

      const { txId } = await contractDeployment({
        signer: oylSigner,
        account: oylAccount,
        payload,
        protostone: Buffer.from(protostone),
        utxos: gatheredUtxos.utxos,
        provider: ALKANES_PROVIDER,
        feeRate: 10,
      });

      console.log(chalk.greenBright("\n✓ Contract Deployed\n"));
      console.log(chalk.gray(`Transaction: ${EXPLORER_URL}/tx/${txId}`));
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
