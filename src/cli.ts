#!/usr/bin/env node
import { run } from './app.js';

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write(`quorum: unexpected error: ${(err as Error).stack ?? err}\n`);
    process.exitCode = 2;
  });
