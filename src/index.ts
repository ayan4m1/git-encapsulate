import { program } from 'commander';
import { availableParallelism } from 'os';

import { encapsulate, getPackageVersion } from './utils.js';

try {
  const description =
    'Archives all Git repositories from the base folder to the output folder.';
  const version = await getPackageVersion();
  const handler = (basePath: string, outputPath?: string) => {
    const { threads } = program.opts();

    encapsulate(basePath, outputPath, {
      threads
    });
  };

  await program
    .version(version)
    .description(description)
    .argument('<base-path>', 'Root of your Git repositories')
    .argument('[output-path]', 'Directory to place output in, defaults to cwd')
    .option('-f, --force', 'Force overwriting existing working copy')
    .option(
      '-t, --threads',
      'Number of concurrent threads to use, defaults to CPU count',
      () => availableParallelism()
    )
    .action(handler)
    .parseAsync();
} catch (error) {
  console.error(error);
  process.exit(1);
}
