import { swapNoSplitFromETH, loadPrivateKeys } from './src/yakrouter';
import { config } from 'dotenv';
import { parseEther, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Load environment variables from .env file
config();

const routerAddress = process.env.CAMELOT_ROUTER as Address;
const adapters = (process.env.CAMELOT_ADAPTER || "").split(",") as Address[];
const recipients = (process.env.CAMELOT_RECIPIENT || "").split(",") as Address[];
const eclipPair = (process.env.ECLIP_PAIR || "").split(",") as Address[];
const tiaPair = (process.env.TIA_PAIR || "").split(",") as Address[];
const maxPayEth = parseEther(process.env.MAX_PAY_ETH || "0.0001");

if (!adapters.length || !recipients.length) {
  throw new Error("Please ensure CAMELOT_ADAPTER and CAMELOT_RECIPIENT are set correctly in your .env file");
}

(async () => {
  // Load private keys
  const privateKeys = loadPrivateKeys('./data/private_keys.txt');

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i] as `0x${string}`;
    const account = privateKeyToAccount(privateKey);

    console.log(`♻️ Swapping ETH for TIA.n on Account ${i + 1}: ${account.address}`);
    await swapNoSplitFromETH(privateKey, maxPayEth, tiaPair, routerAddress, adapters, recipients);
    
    console.log(`♻️ Swapping ETH for ECLIP on Account ${i + 1}: ${account.address}`);
    await swapNoSplitFromETH(privateKey, maxPayEth, eclipPair, routerAddress, adapters, recipients);
  }
})();
