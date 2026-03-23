import { Network, networks } from "bitcoinjs-lib";
import { hexSha256 } from "../crypto/hash.mjs";
import { repositories } from "../persistence/repository.mjs";
import { CliParameterError } from "../error/cli-error.mjs";
import prompts from "prompts";
import { checkHash, isNotString } from "../utils/validator.mjs";

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
      console.warn('BITCOLD_BITCOIN_NETWORK is not set, using mainnet')
      networkSelectNotified = true
    }
    return networks.bitcoin
  }

  if (!networkSelectNotified) {
    console.warn('BITCOLD_BITCOIN_NETWORK is set to ' + definedNetwork)
    networkSelectNotified = true
  }

  return netMappings[definedNetwork.toLowerCase().trim()] ?? networks.bitcoin
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value?.trim() === '' ? undefined : value;
}

export async function ensureCliLevelSecretInitialized() {
  let cliPassphrase = emptyToUndefined(process.env.BITCOLD_PASSPHRASE)
  const secretSha256 = await repositories.secret.get()
  if (secretSha256 === undefined) {
    if (cliPassphrase === undefined) {
      cliPassphrase = await questionUserToCreateCliPassphrase(cliPassphrase);
    }

    await repositories.secret.set(await hexSha256(cliPassphrase!))
  }

  if (cliPassphrase === undefined) {
    cliPassphrase = await questionCliPassphrase(cliPassphrase);
  }

  await checkHash(await repositories.secret.get(), cliPassphrase);

  await repositories.init(cliPassphrase)
}

async function questionUserToCreateCliPassphrase(cliPassphrase: string | undefined) {
  const { value: passphrase } = await prompts({
    type: 'password',
    name: 'value',
    message: 'Create a passphrase for the CLI'
  });

  if (isNotString(passphrase)) {
    throw new CliParameterError('CLI passphrase is required');
  }

  const { value: confirmPassphrase } = await prompts({
    type: 'password',
    name: 'value',
    message: 'Confirm passphrase'
  });
  if (confirmPassphrase !== passphrase) {
    throw new CliParameterError('Passphrases do not match');
  }

  cliPassphrase = passphrase;
  return cliPassphrase;
}

async function questionCliPassphrase(cliPassphrase: string | undefined) {
  const response = await prompts({
    type: 'password',
    name: 'value',
    message: 'Enter a passphrase for the CLI'
  });

  cliPassphrase = response.value;
  if (isNotString(cliPassphrase)) {
    throw new CliParameterError('CLI passphrase is required');
  }
  return cliPassphrase;
}