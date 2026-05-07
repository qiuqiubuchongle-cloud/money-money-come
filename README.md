# Money Money Come

链上聪明钱画像 Skill，帮助 Agent 快速完成三件事：

1. 分析单个聪明钱地址的 PnL、交易习惯、链上行为，输出简洁地址质量报告
2. 对一批聪明钱地址进行分组，并在同组多个高质量地址集中买入同一 meme 时推送 Telegram 信号
3. 对大量地址进行排序、优化、剔除，导出近期活跃、稳定收益、质量较好的地址

## 安全默认值

- 默认仅做分析、分组、提醒
- 不默认执行自动交易
- 热点但低胜率、高亏损的地址会被排除出安全信号池
- 长期不活跃地址不会进入主监控池

## 安装

发布到 GitHub 后，用户可通过类似方式安装：

```bash
npx skills add https://github.com/qiuqiubuchongle-cloud/money-money-come
```

## 配置

复制 `.env.example` 为 `.env`，填入：

- `OKX_API_KEY`
- `OKX_SECRET_KEY`
- `OKX_PASSPHRASE`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

然后执行：

```bash
onchainos wallet login
```

## 典型工作流

### 1. 导入钱包地址

```bash
npm run import-wallets -- examples/gmgn_wallets_input.example.json
```

### 2. 构建画像

```bash
npm run profiles
```

### 3. 生成分组与安全信号池

```bash
npm run wallet-groups
```

### 4. 导出精品地址

```bash
npm run export-curated
```

### 5. 分析单个地址

```bash
npm run wallet-report -- 0x...
```

## 输出文件

- `data/smart_wallet_profiles_bsc.json`
- `data/smart_wallet_groups_bsc.json`
- `data/curated_smart_wallets_bsc.json`
- `data/curated_smart_wallets_bsc.txt`

## 提醒逻辑

强信号默认要求：

- 来自 `safeSignalPool`
- 同一正向组内至少 2 个地址
- 在时间窗口内集中买入同一 token

## 风险提示

该 Skill 仅用于链上分析和提醒，不构成投资建议。任何自动化信号都需要用户自行复核流动性、风险标签和仓位管理。
