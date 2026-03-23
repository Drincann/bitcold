import { Account } from "../domain/account.mjs";
import { BtcAddress } from "../domain/address.mjs";

export function accountSummary(accounts: Map<string, Account>) {
  return [...accounts.entries()].map(([alias, account]) => `${alias} ${addressSummary(account.addresses)}`).join(', ');
}

export function addressSummary(addresses: { BTC: BtcAddress; }) {
  return `${addresses.BTC.address.slice(0, 4)}...${addresses.BTC.address.slice(-4)}`;
}
