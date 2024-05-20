import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

import { loadPrivateKeys } from './src/utils';
import { swapNoSplitFromETH } from './src/camelot';
import { executeTransfers } from './src/nexus';

import { parseEther, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { Arbitrum, getTokenBalance } from './src/client';

// Load environment variables from .env file
config();

const routerAddress = process.env.CAMELOT_ROUTER as Address;
const tiaArbAddress = process.env.TIA_ARB as Address;
const eclipArbAddress = process.env.ECLIP_ARB as Address;
const adapters = (process.env.CAMELOT_ADAPTER || "").split(",") as Address[];
const recipients = (process.env.CAMELOT_RECIPIENT || "").split(",") as Address[];
const eclipPair = (process.env.ECLIP_PAIR || "").split(",") as Address[];
const tiaPair = (process.env.TIA_PAIR || "").split(",") as Address[];
const maxPayEth = parseEther(process.env.MAX_PAY_ETH || "0.000069420");

if (!adapters.length || !recipients.length) {
  throw new Error("Please ensure CAMELOT_ADAPTER and CAMELOT_RECIPIENT are set correctly in your .env file");
}

const coinsFilePath = path.resolve('./data/coins.json');

(async () => {
  try {
    // Load private keys and ensure they start with '0x'
    const privateKeys = loadPrivateKeys('./data/private_keys.txt').map(key => key.startsWith('0x') ? key as `0x${string}` : `0x${key}` as `0x${string}`);
    let balances: any[] = [];

    if (fs.existsSync(coinsFilePath)) {
      console.log(`Skipping swap steps as ${coinsFilePath} already exists.`);
      balances = JSON.parse(fs.readFileSync(coinsFilePath, 'utf8'));
    } else {
      for (let i = 0; i < privateKeys.length; i++) {
        const privateKey = privateKeys[i];
        const account = privateKeyToAccount(privateKey);

        // Get the current nonce for the account
        let nonce = await Arbitrum.getTransactionCount({ address: account.address });

        console.log(`♻️  Swapping ETH for TIA on Account ${i + 1}: ${account.address}`);
        await swapNoSplitFromETH(privateKey, maxPayEth, tiaPair, routerAddress, adapters, recipients, nonce);

        // Increment the nonce for the next transaction
        nonce++;

        console.log(`♻️  Swapping ETH for ECLIP on Account ${i + 1}: ${account.address}`);
        await swapNoSplitFromETH(privateKey, maxPayEth, eclipPair, routerAddress, adapters, recipients, nonce);

        // Increment the nonce for the next transaction
        nonce++;

        // Get the balances of TIA_ARB and ECLIP_ARB
        const tiaBalance = await getTokenBalance(Arbitrum, tiaArbAddress, account.address);
        const eclipBalance = await getTokenBalance(Arbitrum, eclipArbAddress, account.address);

        balances.push({
          address: account.address,
          TIA_ARB: tiaBalance.toString(),  // Convert BigInt to string
          ECLIP_ARB: eclipBalance.toString()  // Convert BigInt to string
        });
      }

      // Write balances to coins.json
      fs.writeFileSync(coinsFilePath, JSON.stringify(balances, null, 2));
    }

    // Execute transfers
    await executeTransfers(privateKeys, balances);

  } catch (error) {
    console.error("An error occurred during the swaps and transfers:", error);
  } finally {
    // Exit the process after all operations are complete
    process.exit();
  }
})();
