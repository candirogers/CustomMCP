import { CommandModule } from 'yargs';
import { logger } from '../../utils/logger.js';

export const searchCommands: CommandModule = {
  command: 'search <query>',
  describe: 'Search photos by query',
  builder: (yargs) =>
    yargs
      .positional('query', {
        type: 'string',
        describe: 'Search query',
      })
      .option('limit', {
        alias: 'l',
        type: 'number',
        description: 'Maximum results',
        default: 50,
      })
      .option('fields', {
        type: 'array',
        description: 'Search fields',
      })
      .option('facets', {
        type: 'boolean',
        description: 'Include faceted results',
        default: false,
      })
      .option('format', {
        choices: ['table', 'json', 'csv'],
        default: 'table',
      }),
  handler: async (argv: any) => {
    logger.info('Search photos command', { query: argv.query, limit: argv.limit });
    // Implementation will be added in Phase 3
  },
};

export default searchCommands;
