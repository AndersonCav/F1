import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const rootDir = resolve(fileURLToPath(new URL('../', import.meta.url)));

export async function checkWhitespace(options = {}) {
  const cwd = options.cwd || rootDir;
  const silent = options.silent || false;

  if (!silent) {
    console.log('[check-whitespace] Running Git whitespace check...');
  }

  try {
    const output = execFileSync('git', ['diff', '--check'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    if (output.trim()) {
      throw new Error(`Git whitespace errors found:\n${output}`);
    }
  } catch (err) {
    if (err.status !== 0 && err.stderr) {
      const stderr = err.stderr.toString().trim();
      // Ignore LF/CRLF warnings from git
      const lines = stderr.split('\n').filter(l => !l.includes('LF will be replaced by CRLF') && !l.includes('CRLF will be replaced by LF'));
      if (lines.length > 0) {
        throw new Error(`Git whitespace error:\n${lines.join('\n')}`);
      }
    } else {
      throw err;
    }
  }

  if (!silent) {
    console.log('[check-whitespace] PASSED: No whitespace issues found.');
  }

  return { verified: true };
}

// Execute if run directly from CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  checkWhitespace().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
