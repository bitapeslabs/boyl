// cli.ts ───────────────────────────────────────── native ESM
import sade from "sade";
import chalk from "chalk";
import commands from "./commands/index.js"; // adjust if needed

const NETWORK_FLAGS = new Map([
  ["--mainnet", "mainnet"],
  ["--boylnet", "boylnet"],
]);

const argv = process.argv.slice(); // copy so we can mutate
let network = "boylnet"; // default

for (let i = 2; i < argv.length; i++) {
  const flag = argv[i];
  if (NETWORK_FLAGS.has(flag)) {
    network = NETWORK_FLAGS.get(flag)!; // chosen network
    argv.splice(i, 1); // delete the flag
    break; // only one allowed
  }
}

const prog = sade("boyl")
  .version("0.8.0")
  .describe(chalk.yellow("Boyl → Alkanes utility CLI, created by @mork1e"));

Object.entries(commands).forEach(([name, CommandClass]) => {
  let cmd = prog
    .command(name.replaceAll(":", " "))
    .describe(CommandClass.description ?? "");

  if (CommandClass.flags) {
    Object.entries(CommandClass.flags).forEach(([flag, meta]) => {
      cmd = cmd.option(`--${flag}`, meta.description ?? "");
    });
  }

  cmd.action(async (...args: any[]) => {
    const opts = args.pop(); // sade’s parsed opts
    const positionals = opts._ ?? [];

    // inject the chosen network so every command sees it
    opts.network = network;

    const instance = new CommandClass();
    try {
      await instance.run(positionals, opts);
    } catch (err) {
      console.error(err);
      instance.error?.(err instanceof Error ? err.message : String(err));
    }
  });
});

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name === "DeprecationWarning") return;
  process.emit("warning", w);
});

prog.parse(argv);
