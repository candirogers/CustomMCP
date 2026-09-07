#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { authCommands } from './commands/auth.js';
import { listCommands } from './commands/list.js';
import { searchCommands } from './commands/search.js';
import { batchCommands } from './commands/batch.js';
import { configCommands } from './commands/config.js';
import { auditCommands } from './commands/audit.js';
import { cacheCommands } from './commands/cache.js';
import { healthCommands } from './commands/health.js';
import { logger } from '../utils/logger.js';

/**
 * Photos CLI
 *
 * Command-line interface for MCP cloud photos operations
 */

const cli = yargs(hideBin(process.argv))
  .scriptName('photos')
  .version('0.1.0')
  .alias('v', 'version')
  .help()
  .alias('h', 'help')
  .strict()
  .option('verbose', {
    alias: 'V',
    type: 'boolean',
    description: 'Enable verbose logging',
    default: false,
  })
  .option('json', {
    type: 'boolean',
    description: 'Output as JSON',
    default: false,
  })
  .option('config', {
    type: 'string',
    description: 'Path to configuration file',
  })
  .middleware((argv: any) => {
    if (argv.verbose) {
      logger.setLevel('debug');
    }
  })

  // Authentication commands
  .command(authCommands)

  // Photo listing commands
  .command(listCommands)

  // Search commands
  .command(searchCommands)

  // Batch operation commands
  .command(batchCommands)

  // Configuration commands
  .command(configCommands)

  // Audit commands
  .command(auditCommands)

  // Cache commands
  .command(cacheCommands)

  // Health commands
  .command(healthCommands)

  // Default command
  .default('help');

// Execute CLI
cli.parseAsync().catch((error: Error) => {
  logger.error('CLI error:', error);
  process.exit(1);
});

export default cli;
