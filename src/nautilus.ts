import { config } from 'dotenv';
import { sleep, loadPrivateKeys } from './utils';
import { createWalletClient, encodeFunctionData, Address, http, fallback, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { BSC, getTokenBalance, getTokenDecimals, transferRemoteAbi, erc20Abi } from './client';

// Load environment variables from .env file
config();

const providerUrl = process.env.BSC_RPC as string;
const nautilusSendTokens = process.env.NAUTILUS_SEND_TOKENS ? process.env.NAUTILUS_SEND_TOKENS.split(',') : [];
const chainId = parseInt(process.env.NAUTILUS_CHAIN_ID || "22222", 10) as number;
const interchainGasFee = BigInt(process.env.INTERCHAIN_GAS_FEE_BSC || "369655053048");

const tokenAddresses: { [key: string]: Address } = {
  ZBC: process.env.BSC_ZBC as Address,
  ETH: process.env.BSC_ETH as Address,
  USDC: process.env.BSC_USDC as Address,
  USDT: process.env.BSC_USDT as Address,
  BTC: process.env.BSC_BTC as Address,
  POSE: process.env.BSC_POSE as Address,
};

const bridgeContracts: { [key: string]: Address } = {
  ZBC: process.env.BSC_ZBC_BRIDGE as Address,
  ETH: process.env.BSC_ETH_BRIDGE as Address,
  USDC: process.env.BSC_USDC_BRIDGE as Address,
  USDT: process.env.BSC_USDT_BRIDGE as Address,
  BTC: process.env.BSC_BTC_BRIDGE as Address,
  POSE: process.env.BSC_POSE_BRIDGE as Address,
};

if (!providerUrl || !bridgeContracts.USDC || !bridgeContracts.ZBC) {
  throw new Error("Please ensure BSC_RPC, NAUTILUS_USDC_BRIDGE, and NAUTILUS_ZBC_BRIDGE are set in your .env file");
}

if (!nautilusSendTokens.length) {
  throw new Error("Please ensure NAUTILUS_SEND_TOKENS is set in your .env file");
}

// Function to get the appropriate router based on the token
function getRouter(token: string): Address {
  return bridgeContracts[token] || bridgeContracts.USDC;
}

// Create a function to approve tokens
export async function approveToken(
  privateKey: `0x${string}`,
  token: string,
  amount: bigint
) {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: bsc,
    transport: fallback([http(providerUrl)], {
      rank: {
        interval: 60_000,
        sampleCount: 5,
        timeout: 500,
        weights: {
          latency: 0.3,
          stability: 0.7
        }
      }
    }),
  });

  const tokenAddress = tokenAddresses[token];
  if (!tokenAddress) throw new Error(`Token address for ${token} not found`);

  const router = getRouter(token);

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [router, amount]
  });

  const txHash = await walletClient.sendTransaction({
    account,
    to: tokenAddress,
    data: approveData,
  });

  // Get the decimals of the token
  const tokenDecimals = await getTokenDecimals(BSC, tokenAddress);
  const formattedAmount = Number(formatUnits(amount, tokenDecimals)).toFixed(tokenDecimals);

  console.log(`🚀 Successfully approved ${formattedAmount} ${token} for ${router} on account ${account.address}`);
  console.log(`https://bscscan.com/tx/${txHash}`);
  await sleep(6942);
}

// Create a function to transfer tokens using transferRemote
export async function transferToken(
  privateKey: `0x${string}`,
  token: string,
  destination: number,
  recipient: Address,
  amount: bigint,
  nonce: number,
) {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: bsc,
    transport: fallback([http(providerUrl)], {
      rank: {
        interval: 60_000,
        sampleCount: 5,
        timeout: 500,
        weights: {
          latency: 0.3,
          stability: 0.7
        }
      }
    }),
  });

  const recipientHex = recipient.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const transferData = encodeFunctionData({
    abi: transferRemoteAbi,
    functionName: 'transferRemote',
    args: [destination, `0x${recipientHex}`, amount]
  });

  const router = getRouter(token);

  try {
    const txHash = await walletClient.sendTransaction({
      account,
      to: router,
      data: transferData,
      nonce,
      value: interchainGasFee // Value in Wei for interchain gas payment
    });

    // Get the decimals of the token
    const tokenDecimals = await getTokenDecimals(BSC, tokenAddresses[token]);
    const formatToken = Number(formatUnits(amount, tokenDecimals)).toFixed(tokenDecimals);

    console.log(`➡️  Successfully transferred ${formatToken} ${token} for ${recipient} to chain ${destination} for account ${account.address}`);
    console.log(`https://bscscan.com/tx/${txHash}`);
  } catch (error) {
    console.error("Failed to send transaction:", error);
  }
}

// Main function to execute the approval and transfer
(async () => {
  try {
    // Load private keys
    const privateKeys = loadPrivateKeys('./data/private_keys.txt').map(key => key as `0x${string}`);

    for (let i = 0; i < privateKeys.length; i++) {
      const privateKey = privateKeys[i];
      const account = privateKeyToAccount(privateKey);

      // Get the current nonce for the account
      let nonce = await BSC.getTransactionCount({ address: account.address });

      for (const token of nautilusSendTokens) {
        const tokenAddress = tokenAddresses[token];
        if (!tokenAddress) throw new Error(`Token address for ${token} not found`);

        // Get the balance of the token for the account
        //console.log(`Getting balance for address ${account.address} on token contract ${tokenAddress}`);
        const tokenBalance = await getTokenBalance(BSC, tokenAddress, account.address);
        //console.log(`Balance for ${token} on account ${account.address} is ${tokenBalance}`);

        // Get the decimals of the token
        const tokenDecimals = await getTokenDecimals(BSC, tokenAddress);
        const tokenBalanceInUnits = Number(formatUnits(tokenBalance, tokenDecimals)).toFixed(tokenDecimals);
        //console.log(`Token decimals for ${token}:${tokenDecimals}`)
        console.log(`Balance for account ${account.address} is ${tokenBalanceInUnits} ${token}`);

        if (tokenBalance > 0n) {
          // Approve the token
          console.log(`🔄 Approving ${token} for router on Account ${i + 1}: ${account.address}`);
          await approveToken(privateKey, token, tokenBalance);
          nonce++;

          // Transfer the token
          console.log(`🔄 Transferring ${token} for Account ${i + 1}: ${account.address}`);
          await transferToken(privateKey, token, chainId, account.address, tokenBalance, nonce);
          nonce++;
        } else {
          console.log(`⚠️  Skipping ${token} for Account ${i + 1}: ${account.address} (Insufficient balance)`);
        }
      }
    }
  } catch (error) {
    console.error("An error occurred during the approvals and transfers:", error);
  }
})();
