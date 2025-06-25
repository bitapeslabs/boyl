import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { gzip as _gzip } from "zlib";
import { FormattedUtxo } from "@/libs/alkanes";
import { AlkanesPayload } from "./shared/types";
import { encodeRunestoneProtostone, ProtoStone, encipher } from "alkanes";
import { EsploraUtxo, IEsploraTransaction } from "@/apis/esplora/types";
import { esplora_getbulktransactions } from "@/apis/esplora";
import { BoxedResponse, BoxedSuccess, isBoxedError } from "@/boxed";

export interface AlkanesDeploymentParams {
  contract: Uint8Array;
  payload: AlkanesPayload;
  protostone: Uint8Array;
  callData: bigint[];
}

const gzip = promisify(_gzip);

export async function getAlkanesDeploymentParamsFromWasmPath(
  wasmPath: string
): Promise<AlkanesDeploymentParams> {
  const contract = new Uint8Array(
    await fs.readFile(path.resolve(process.cwd(), wasmPath))
  );
  const payload: AlkanesPayload = {
    body: await gzip(contract, { level: 9 }),
    cursed: false,
    tags: { contentType: "" }, // set if you want MIME-style tagging
  };

  const callData = [1n, 0n];

  const protostone = encodeRunestoneProtostone({
    protostones: [
      ProtoStone.message({
        protocolTag: 1n,
        edicts: [],
        pointer: 0,
        refundPointer: 0,
        calldata: encipher(callData),
      }),
    ],
  }).encodedRunestone;

  return { contract, payload, protostone, callData };
}

export const esploraUtxosToFormattedUtxos = async (
  esploraUtxos: EsploraUtxo[]
): Promise<BoxedResponse<FormattedUtxo[], string>> => {
  const txs = await esplora_getbulktransactions(
    esploraUtxos.map((utxo) => utxo.txid)
  );

  if (isBoxedError(txs)) {
    return txs;
  }

  const txMap = new Map<string, IEsploraTransaction>(
    txs.data.map((tx) => [tx.txid, tx])
  );

  const formattedUtxos: FormattedUtxo[] = esploraUtxos.map((utxo) => {
    const tx = txMap.get(utxo.txid);
    if (!tx) {
      throw new Error(
        `Transaction ${utxo.txid} not found in fetched transactions`
      );
    }

    return {
      txId: utxo.txid,
      outputIndex: utxo.vout,
      satoshis: utxo.value,
      scriptPk: tx.vout[utxo.vout].scriptpubkey,
      address: tx.vout[utxo.vout].scriptpubkey_address,
      inscriptions: [],
      runes: {},
      alkanes: {},
      indexed: tx.status.confirmed ? true : false,
      confirmations: tx.status.confirmed ? 1 : 0,
    };
  });
  return new BoxedSuccess(formattedUtxos);
};
