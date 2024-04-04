import { existsSync } from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { coerce, satisfies } from 'semver';
import { lstat, mkdir, readFile, readdir } from 'fs/promises';
import { basename, dirname, join, resolve } from 'path';
import { exec as rawExec, spawn } from 'child_process';

export type ExecuteResults = [string, string];

export type CloneSparseOptions = {
  force: boolean;
};

const exec = promisify(rawExec);

const getInstallDirectory = (): string =>
  dirname(fileURLToPath(import.meta.url));

const getPackageJsonPath = (): string =>
  resolve(getInstallDirectory(), '..', 'package.json');

const isGitInstallValid = async (): Promise<boolean> => {
  try {
    const [version] = await executeCommand("git -v | cut -d' ' -f3");

    const gitVersion = coerce(version);
    if (!gitVersion) {
      return false;
    }

    return satisfies(gitVersion, '>=2.x');
  } catch {
    return false;
  }
};

const executeCommand = async (
  command: string,
  cwd: string = './',
  args: string[] = []
): Promise<ExecuteResults> => {
  const { stdout, stderr } = await exec(
    `${command} ${args.join(' ')}`.trim().replace(/\\n$/, ''),
    { cwd }
  );

  return [stdout, stderr];
};

const executeGitCommand = (cwd: string, args: string[] = []): Promise<void> =>
  new Promise(
    (resolve: () => void, reject: (reason?: string | Error) => void) => {
      const stderr = [];
      const process = spawn('git', args, { cwd, stdio: [0, 0, 'pipe'] });

      process.stderr.setEncoding('utf-8');
      process.stderr.on('data', (chunk) => stderr.push(chunk));
      process.on('error', () => reject(`Error occurred during execution!`));
      process.on('close', (code: number) =>
        code === 0
          ? resolve()
          : reject(`Exited with code ${code}. Details:\n\n${stderr.join('')}`)
      );
    }
  );

export const getPackageVersion = async (): Promise<string> =>
  JSON.parse(await readFile(getPackageJsonPath(), 'utf-8'))?.version;

export async function encapsulate(
  basePath: string,
  outputPath: string = process.cwd()
): Promise<void> {
  try {
    if (!basePath) {
      throw new Error('Invalid arguments supplied!');
    }

    if (!existsSync(basePath)) {
      throw new Error(`${basePath} does not exist!`);
    }

    if (!existsSync(outputPath)) {
      await mkdir(outputPath, {
        recursive: true
      });
    }

    if (!isGitInstallValid()) {
      throw new Error('Git >= 2.x was not found!');
    }

    const files = [];
    const repositories = [];

    for (const entry of await readdir(basePath)) {
      const path = join(basePath, entry);
      const stats = await lstat(path);

      if (stats.isDirectory()) {
        const repoGitDir = join(path, '.git');
        const repoGitStats = await lstat(repoGitDir);

        if (repoGitStats.isDirectory()) {
          repositories.push(path);
        }
      } else if (stats.isFile()) {
        files.push(path);
      }
    }

    for (const repoPath of repositories) {
      await executeGitCommand(repoPath, [
        'archive',
        'HEAD',
        '--format=tgz',
        `--output=${join(outputPath, `${basename(repoPath)}.tgz`)}`
      ]);
    }
    console.log('Complete!');
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
