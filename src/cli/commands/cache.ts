import { CommandModule } from 'yargs';
import { logger } from '../../utils/logger.js';

export const cacheCommands: CommandModule = {
  command: 'cache <command>',
  describe: 'Cache management',
  builder: (yargs) =>
    yargs
      .command('clear', 'Clear cache', {
        before: {
          type: 'string',
          description: 'Clear entries older than (e.g., "2h")',
        },
      })
      .command('status', 'Show cache status')
      .command('prefetch', 'Pre-load metadata cache', {
        limit: {
          type: 'number',
          default: 500,
        },
      }),
  handler: async (argv: any) => {
    logger.info('Cache command', { command: argv.command });
    // Implementation will be added in Phase 3
  },
};

export default cacheCommands;
