import { Command } from "@/commands/base";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { AlkanesRpc } from "@/libs/alkanes";
import { AlkaneSimulateRequest } from "@/libs/alkanes/types";
import { ALKANES_PROVIDER } from "@/consts";

/* ------------------------------------------------------------------ */
/* 1.  util — convert `"123n"` literals into real BigInt on JSON.parse */
/* ------------------------------------------------------------------ */
const bigintReviver = (_: string, value: any) =>
  typeof value === "string" && /^-?\d+n$/.test(value.trim())
    ? BigInt(value.slice(0, -1)) // drop the trailing "n"
    : value;

/* ------------------------------------------------------------------ */
/* 2.  util — walk an object, turn any BigInt back into decimal string */
/* ------------------------------------------------------------------ */
const stringifyBigInts = (val: any): any => {
  if (typeof val === "bigint") return val.toString(); // 123n  -> "123"
  if (Array.isArray(val)) return val.map(stringifyBigInts);
  if (val && typeof val === "object") {
    return Object.fromEntries(
      Object.entries(val).map(([k, v]) => [k, stringifyBigInts(v)])
    );
  }
  return val;
};

/* ------------------------------------------------------------------ */
/* 3.  very loose zod schema – tweak as your request spec stabilises   */
/* ------------------------------------------------------------------ */
const maybeBig = z.union([z.string(), z.number(), z.bigint()]);
const requestSchema = z
  .object({
    alkanes: z.array(z.any()).optional(),
    transaction: z.string().optional(),
    block: z.string().optional(),
    height: maybeBig.optional(),
    txindex: maybeBig.optional(),
    inputs: z.array(maybeBig).optional(),
    pointer: maybeBig.optional(),
    refundPointer: maybeBig.optional(),
    vout: maybeBig.optional(),
    target: z
      .object({
        block: maybeBig.optional(),
        tx: maybeBig.optional(),
      })
      .optional(),
  })
  .partial();

/* ------------------------------------------------------------------ */
/* 4.  simulate command                                               */
/* ------------------------------------------------------------------ */
export class Simulate extends Command {
  static override description = "Run an Alkanes contract simulation";
  static override examples = [
    "$ boyl simulate ./simulate-request.json",
    "$ boyl simulate ./simulate-request.json ./decoder.js",
  ];

  public override async run(args: string[]): Promise<void> {
    const alkanes = new AlkanesRpc(ALKANES_PROVIDER.url);

    try {
      /* ---------- argument parsing ---------- */
      if (args.length === 0) {
        this.error(
          "Please provide the path to a simulation-request JSON file."
        );
        return;
      }

      const requestPath = path.resolve(process.cwd(), args[0]);
      const decoderPath = args[1] ? path.resolve(process.cwd(), args[1]) : null;

      /* ---------- load & validate request ---------- */
      const rawFile = await fs.readFile(requestPath, "utf8");
      const parsedInput = JSON.parse(rawFile, bigintReviver); // "123n" → 123n
      const requestZodOk = requestSchema.parse(parsedInput);

      /* ---------- optional decoder ---------- */
      let decoder: any = undefined;
      if (decoderPath) {
        const mod = await import(decoderPath);
        decoder = mod.default ?? mod;
      }

      /* ---------- convert bigint → decimal strings for RPC ---------- */
      const rpcReadyRequest = stringifyBigInts(
        requestZodOk
      ) as Partial<AlkaneSimulateRequest>;

      /* ---------- call RPC ---------- */

      console.log(rpcReadyRequest);
      const result = await alkanes.simulate(rpcReadyRequest, decoder);

      console.log(chalk.greenBright("\n✓ Simulation complete\n"));
      console.dir(result.parsed ?? result, { depth: null, colors: true });
    } catch (err) {
      this.error(
        `Failed to run simulation: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  }
}

export default Simulate;
