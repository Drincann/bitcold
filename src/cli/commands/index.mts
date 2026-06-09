import { Command } from 'commander';
import { walletCreateCommand } from './wallet/create.mjs';
import { walletRenameCommand } from './wallet/rename.mjs';
import { walletShowCommand } from './wallet/show.mjs';
import { walletListCommand } from './wallet/list.mjs';
import { walletRemoveCommand } from './wallet/remove.mjs';
import { createWalletAccountCommand, walletAccountCommand } from './wallet/account.mjs';
import { createWalletReceiveCommand, walletReceiveCommand } from './wallet/receive.mjs';

import { txSignCommand } from './tx/sign.mjs';

export const walletCommand = new Command()
  .name('wallet')
  .description('Manage wallets')

  .addCommand(walletCreateCommand)
  .addCommand(walletRenameCommand)
  .addCommand(walletShowCommand)
  .addCommand(walletListCommand)
  .addCommand(walletRemoveCommand)
  .addCommand(walletAccountCommand)
  .addCommand(walletReceiveCommand)

export const txCommand = new Command()
  .name('tx')
  .description('Sign transactions')

  .addCommand(txSignCommand)

export const accountCommand = createWalletAccountCommand()
export const receiveCommand = createWalletReceiveCommand()
