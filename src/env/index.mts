import { Network, networks } from "bitcoinjs-lib";
import { repositories } from "../persistence/repository.mjs";
import { CliParameterError } from "../error/cli-error.mjs";
import prompts from "prompts";
import { isNotString } from "../utils/validator.mjs";

const netMappings = {
  'testnet': networks.testnet,
  'mainnet': networks.bitcoin,
  'regtest': networks.regtest,
  'bitcoin': networks.bitcoin,
} as Record<string, Network>

let networkSelectNotified = false;
export function getBtcNetwork(): Network {
  const definedNetwork = emptyToUndefined(process.env.BITCOLD_BITCOIN_NETWORK)
  if (definedNetwork === undefined) {
    if (!networkSelectNotified) {
      console.warn('warn: using mainnet (BITCOLD_BITCOIN_NETWORK not set)')
      networkSelectNotified = true
    }
    return networks.bitcoin
  }

  if (!networkSelectNotified) {
    console.warn('warn: using ' + definedNetwork)
    networkSelectNotified = true
  }

  const net = netMappings[definedNetwork.toLowerCase().trim()]
  if (!net) {
    throw new Error(`Invalid BITCOLD_BITCOIN_NETWORK: ${definedNetwork}. Expected one of: ${Object.keys(netMappings).join(', ')}`)
  }
  return net
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value?.trim() === '' ? undefined : value;
}

export async function ensureCliLevelSecretInitialized() {
  let cliPassphrase = emptyToUndefined(process.env.BITCOLD_PASSPHRASE)
  if (!(await repositories.initialized())) {
    if (cliPassphrase === undefined) {
      cliPassphrase = await questionUserToCreateCliPassphrase();
    }
    repositories.init(cliPassphrase!)
    await repositories.wallet.init()
    return
  }

  if (cliPassphrase === undefined) {
    cliPassphrase = await questionCliPassphrase();
  }

  repositories.init(cliPassphrase!)
  await repositories.wallet.getAllWallets()
}

async function questionUserToCreateCliPassphrase() {
  const { value: passphrase } = await prompts({
    type: 'password',
    name: 'value',
    message: 'Create a passphrase for the CLI'
  });

  if (isNotString(passphrase) || passphrase.length < 1) {
    throw new CliParameterError('CLI passphrase is required and cannot be empty');
  }

  const { value: confirmPassphrase } = await prompts({
    type: 'password',
    name: 'value',
    message: 'Confirm passphrase'
  });
  if (confirmPassphrase !== passphrase) {
    throw new CliParameterError('Passphrases do not match');
  }

  return passphrase;
}

async function questionCliPassphrase() {
  const response = await prompts({
    type: 'password',
    name: 'value',
    message: 'Enter a passphrase for the CLI'
  });

  const cliPassphrase = response.value;
  if (isNotString(cliPassphrase) || cliPassphrase.length < 1) {
    throw new CliParameterError('CLI passphrase is required and cannot be empty');
  }
  return cliPassphrase;
}
