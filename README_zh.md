<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/banner-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/banner-light.svg">
  <img alt="bitcold" src="docs/banner-dark.svg" width="100%">
</picture>

一个轻量级 CLI，用于生成比特币冷钱包、管理密钥，并离线签署交易。

[English](./README.md) | **简体中文**

> **完整的文档、命令参考和示例请访问 [bitcold.dev](https://bitcold.dev)**

## 安装

```
npm install -g bitcold
```

## 快速开始

```bash
# 创建一个别名为 'wallet_0' 的钱包
bitcold wallet create wallet_0

# 显示 BIP84 account 信息
bitcold wallet show wallet_0@account_0:0 --private --mnemonic

# 签署交易（预览交易并输出 raw transaction 二维码）
bitcold tx sign --from wallet_0@account_0:0 --to bc1q... \
  --amount 50000 --fee 1500 \
  --utxo <txid:vout:value> \
  --qr

# 显示收款地址二维码
bitcold wallet receive wallet_0@account_0:0
```
