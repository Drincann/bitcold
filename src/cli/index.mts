import { Command } from 'commander';
import { txCommand, walletCommand } from './commands/index.mjs';

export const program = new Command()
  .name('bitcold')
  .description('bitcold is a lightweight and simple CLI for managing Bitcoin cold wallets and offline transaction signing.')
  .version('alpha')

  .addCommand(walletCommand)
  .addCommand(txCommand);
