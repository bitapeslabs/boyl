import chalk from "chalk";
import { ZodTypeAny } from "zod";

type Flags = {
  [key: string]: ZodTypeAny;
};

export class Command {
  public static description: string;
  public static examples: string[];
  public static flags: Flags = {};

  error(message: string): never {
    console.error(`${chalk.red("✖ ERROR:")} ${message}`);
    process.exit(1);
  }

  warn(message: string): void {
    console.warn(`${chalk.yellow("⚠")} ${message}`);
  }

  log(message: string): void {
    console.log(`${chalk.cyan("›")} ${message}`);
  }

  run(args: string[], opts: Record<string, unknown>): Promise<void> {
    return this.error(
      "Command not implemented. Please override the run() method in your command class."
    );
  }
}
