import { CommandModule } from 'yargs';
import { logger } from '../../utils/logger.js';

export const batchCommands: CommandModule = {
  command: 'batch <operation> [photoIds...]',
  describe: 'Perform batch operations on photos',
  builder: (yargs) =>
    yargs
      .positional('operation', {
        choices: ['tag', 'move', 'archive', 'delete'],
        describe: 'Operation to perform',
      })
      .positional('photoIds', {
        type: 'string',
        describe: 'Photo IDs (space-separated)',
      })
      .option('tag', {
        type: 'string',
        description: 'Tag name (for tag operation)',
      })
      .option('album', {
        type: 'string',
        description: 'Album ID (for move operation)',
      })
      .option('confirm', {
        type: 'boolean',
        description: 'Skip confirmation prompt',
        default: false,
      })
      .option('format', {
        choices: ['table', 'json'],
        default: 'table',
      }),
  handler: async (argv: any) => {
    logger.info('Batch operation command', { operation: argv.operation, photoIds: argv.photoIds });
    // Implementation will be added in Phase 3
  },
};

export default batchCommands;
