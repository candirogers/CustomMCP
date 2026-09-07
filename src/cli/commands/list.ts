import { CommandModule } from 'yargs';
import { logger } from '../../utils/logger.js';

export const listCommands: CommandModule = {
  command: 'list [filter]',
  describe: 'List photos with optional filtering',
  builder: (yargs) =>
    yargs
      .option('limit', {
        alias: 'l',
        type: 'number',
        description: 'Maximum number of photos to list',
        default: 50,
      })
      .option('filter', {
        type: 'string',
        description: 'JSON filter object',
      })
      .option('fields', {
        type: 'array',
        description: 'Sparse fields to include',
      })
      .option('format', {
        choices: ['table', 'json', 'csv'],
        default: 'table',
      }),
  handler: async (argv: any) => {
    logger.info('List photos command', { limit: argv.limit, filter: argv.filter });
    // Implementation will be added in Phase 3
  },
};

export default listCommands;
