import { CommandModule } from 'yargs';
import { logger } from '../../utils/logger.js';

export const authCommands: CommandModule = {
  command: 'auth <command>',
  describe: 'Authentication management',
  builder: (yargs) =>
    yargs
      .command('login', 'Authenticate with cloud provider', {
        provider: {
          choices: ['google-photos', 'aws-s3', 'azure', 'onedrive'],
          description: 'Cloud provider to authenticate with',
          demandOption: false,
        },
      })
      .command('status', 'Show current authentication status')
      .command('refresh', 'Force token refresh')
      .command('logout', 'Revoke authentication and cleanup'),
  handler: async (argv: any) => {
    logger.info(`Auth command: ${argv.command}`);
    // Implementation will be added in Phase 3
  },
};

export default authCommands;
