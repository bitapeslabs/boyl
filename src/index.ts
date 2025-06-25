import sade from "sade";
import chalk from "chalk";
import commands from "./commands";

const prog = sade("boyl");

prog
  .version("0.8.0")
  .describe(chalk.yellow("Boyl -> alkanes utility CLI, created by @mork1e"));

Object.entries(commands).forEach(([name, CommandClass]) => {
  let cmd = prog
    .command(name.replaceAll(":", " "))
    .describe(CommandClass.description ?? "");

  if (CommandClass.flags) {
    Object.entries(CommandClass.flags).forEach(([flag, type]) => {
      cmd = cmd.option(`--${flag}`, type.description ?? "");
    });
  }

  cmd.action(async (...args: any[]) => {
    const opts = args.pop();
    const positionals = opts._ ?? [];

    const commandInstance = new CommandClass();
    try {
      await commandInstance.run(positionals, opts);
    } catch (err) {
      console.log(err);
      commandInstance.error?.(err instanceof Error ? err.message : String(err));
    }
  });
});

process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name === "DeprecationWarning") {
    // Ignore this specific warning
    return;
  }
  // Forward others
  process.emit("warning", warning);
});

prog.parse(process.argv);
