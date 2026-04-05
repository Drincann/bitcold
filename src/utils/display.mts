import { Account } from "../domain/account.mjs";

export function accountSummary(accounts: Map<string, Account>) {
  return [...accounts.entries()].map(([alias, account]) => `${alias} ${pubkeySummary(account.getPublicKey())}`).join(', ');
}

export function pubkeySummary(pubkey: string) {
  return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
}

export function xpubkeySummary(pubkey: string) {
  return `${pubkey.slice(0, 5)}...${pubkey.slice(-4)}`;
}

export function addressSummary(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
