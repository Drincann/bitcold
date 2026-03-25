import { EncryptedUserHomeJsonStorage } from "./storage.mjs"
import type { Collections, StoredWalletData } from "../domain/types.mjs"

let storage: EncryptedUserHomeJsonStorage<Collections> = new EncryptedUserHomeJsonStorage('');

class WalletRepository {
  public async getAllWallets(): Promise<StoredWalletData[]> {
    return await storage.load('wallets') ?? []
  }

  public async getWallet(alias: string): Promise<StoredWalletData | undefined> {
    return (await this.getAllWallets()).find(wallet => wallet.alias === alias)
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
  initialized: () => storage.initialized(),
  init: async (passphrase: string) => {
    storage = new EncryptedUserHomeJsonStorage(passphrase)
  }
}
