<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/banner-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/banner-light.svg">
  <img alt="bitcold" src="docs/banner-dark.svg" width="100%">
</picture>

一个轻量级的命令行工具，用于生成比特币冷钱包、管理密钥以及离线签署交易。

[English](./README.md) | **简体中文**

> **完整的文档、命令参考和示例请访问 [bitcold.dev](https://bitcold.dev)**

## 安装

```
npm install -g bitcold
```

## 快速开始

```bash
# 创建钱包
bitcold wallet create --alias my-wallet

# 显示钱包详情
bitcold wallet show my-wallet --private --mnemonic

# 签署交易
bitcold tx sign --from my-wallet@default --to bc1q... \
  --amount 50000 --fee 1500 --utxo <txid:vout:value>
```
