[![Status](https://img.shields.io/badge/status-active-success.svg)](https://github.com/whonion/ts-hyperline-aio/blob/main/)  [![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![Build TS](https://github.com/whonion/ts-hyperline-aio/actions/workflows/build.yml/badge.svg)](https://github.com/whonion/ts-hyperline-aio/actions/workflows/build.yml)  [![viem](https://img.shields.io/badge/viem-2.13.0-blue)](https://www.npmjs.com/package/viem) ![Node Version](https://img.shields.io/badge/Node.js-20.12.12-blue.svg)    ![node-fetch Version](https://img.shields.io/badge/node--fetch-3.3.2-blueviolet.svg) [![ts-node](https://img.shields.io/badge/ts--node-10.9.2-brightgreen)](https://www.npmjs.com/package/ts-node)   ![cosmjs/proto-signing Version](https://img.shields.io/badge/cosmjs/proto--signing-0.32.3-orange.svg) ![Bech32 Version](https://img.shields.io/badge/bech32-2.0.0-brightgreen.svg) ![dotenv Version](https://img.shields.io/badge/dotenv-16.4.5-yellow.svg)</br>

## hyperline-aio
TypeScript Implementation of bridger and minter for hyperline projects
<hr>

## Features
### Implemented functions:
- [x] Buy TIA.n and Eclip in [Camelot](https://camelot.exchange) on `Arbitrum`
- [x] Send TIA.n and Eclip from `Arbitrim` to `Neutron` via bridge [Nexus](https://www.usenexus.org/)
- [x] Buy `BTC,ETH,USDT,USDC,ZBC` [ODOS](https://odos.xyz) on `BNB-chain`
- [x] Send `BTC,ETH,USDT,USDC,ZBC` from `BNC-chain` to `Nautilus` via [Nautilus bridge](https://www.nautilusbridge.com)
### Necessary to implement:
- [ ] Autocalculate `local gas fee` and `interchain gas fee`
- [ ] IBC Transaction from Celestia to Neutron
- [ ] Zeroway minter and bridger 
- [ ] Bebop api swaps sattlement
- [ ] Reverse transfer to the target network
<hr>

## Installation and running
#### 1. Install `Node.js`
```sh
sudo apt install git
sudo apt install nodejs
sudo apt install npm
node -v
npm -v
```
<hr>

#### 2. Clone repo and install dependencies
```sh
git clone https://github.com/whonion/ts-hyperline-aio.git
cd ts-hyperline-aio
npm i
npm i -g typescript
```
<hr>

#### 3. Rename `.env.example` to `.env` and set required variables:
```ini
# Variables for module nexus.ts
#LOCAL_GAS_FEE=0.0011
#INTERCHAIN_GAS_FEE=0.0003
ARB_EXP = 'https://arbiscan.io/tx/'
ARB_RPC = 'https://arbitrum.llamarpc.com'

MAX_PAY_ETH = 0.0000069420
MAX_PAY_BNB = 0.0000069420

# Variables for module nautilus.ts
BSC_RPC = 'https://bsc.meowrpc.com'
INTERCHAIN_GAS_FEE_BSC=369655053048
INTERCHAIN_GAS_FEE_NAUTILUS=4660001
NAUTILUS_SEND_TOKENS=BTC,ETH,USDT,USDC,ZBC
```
<hr>

#### 4. Rename `data/private_keys.txt.example` to `data/private_keys.txt` and add your private keys (can add without `0x`)
```env
0x
0x
0x
0x
0x
0x
0x
0x
0x
0x
```
<hr>


#### 5. Run script with command:
```sh
npm run app
```
<hr>


#### 6. Run individual module:
```json
  "scripts": {
    "app": "npm-run-all nexus odos bridge",

    "nexus": "ts-node main.ts",
    "odos": "ts-node src/odos.ts",
    "bridge": "ts-node src/nautilus.ts",
    "unbridge": "ts-node src/nautilusback.ts",

    "build": "tsc --project tsconfig.json",
    "clean": "tsc --build --clean"
  }
```
```sh
npm run nexus
npm run odos
npm run bridge

npm run unbridge

npm run build
npm run clean
```