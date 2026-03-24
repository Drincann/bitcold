import fs from 'fs/promises'
import path from 'path'
import { isEnvelopeV1 } from '../crypto/aes.mjs'
import { CliInternalError, CliParameterError } from '../error/cli-error.mjs'
import { EncryptedUserHomeJsonStorage, Storage, getStorageRoot } from "./storage.mjs"
import type { Collections, StoredWalletData } from "../domain/types.mjs"

let storage: Storage<Collections> = new EncryptedUserHomeJsonStorage('');

export async function checkWalletsFileExists(): Promise<boolean> {
  try {
    await fs.access(path.join(getStorageRoot(), 'wallets.json'))
    return true
  } catch (err) {
    throw new CliInternalError('Could not access wallets.json (permissions or filesystem error).', err)
  }
}

export async function checkWalletsFileIsEncrypted(): Promise<boolean> {
  try {
    const filePath = path.join(getStorageRoot(), 'wallets.json')
    let text: string = await fs.readFile(filePath, 'utf-8')
    let o = JSON.parse(text)
    return isEnvelopeV1(o)
  } catch (err) {
    throw new CliParameterError(
      'wallets.json is not valid encrypted wallet store. repair the file or restore from backup.',
      err
    )
  }
}

class WalletRepository {
  public async getAllWallets(): Promise<StoredWalletData[]> {
    return await storage.load('wallets') ?? []
  }

  public async getWallet(alias: string): Promise<StoredWalletData | undefined> {
    return (await this.getAllWallets()).find(wallet => wallet.alias === alias)
  }

  public async setAllWallets(wallets: StoredWalletData[]): Promise<void> {
    await storage.save('wallets', wallets)
  }

  public async save(wallet: StoredWalletData): Promise<void> {
    await storage.save('wallets', [...await storage.load('wallets') ?? [], wallet])
  }

  public async updateWallet(wallet: StoredWalletData): Promise<void> {
    const wallets = await storage.load('wallets') ?? []
    const idx = wallets.findIndex(w => w.alias === wallet.alias)
    if (idx === -1) {
      throw new Error(`Wallet '${wallet.alias}' not found`)
    }
    const next = [...wallets]
    next[idx] = wallet
    await storage.save('wallets', next)
  }

  public async remove(walletAlias: string) {
    await storage.save('wallets', (await storage.load('wallets')).filter(wallet => wallet.alias !== walletAlias))
  }

  public async rename(fromWallet: any, toWallet: any) {
    await storage.save('wallets', (await storage.load('wallets')).map(wallet => {
      if (wallet.alias === fromWallet) {
        wallet.alias = toWallet
      }
      return wallet
    }))
  }
}

const walletRepo = new WalletRepository()
export const repositories = {
  wallet: walletRepo,
  init: async (passphrase: string) => {
    storage = new EncryptedUserHomeJsonStorage(passphrase)
  }
}
