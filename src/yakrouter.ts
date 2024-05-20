import { config } from 'dotenv';
import { createWalletClient, createPublicClient, encodeFunctionData, Abi, Address, http, fallback } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
config();

const providerUrl = process.env.ARB_RPC as string;
const routerAddress = process.env.CAMELOT_ROUTER as Address;
const eclipPair = (process.env.ECLIP_PAIR || "").split(",") as Address[];
const tiaPair = (process.env.TIA_PAIR || "").split(",") as Address[];
const arb_exp = process.env.ARB_EXP;

if (!providerUrl || !routerAddress) {
  throw new Error("Please ensure ARB_RPC and CAMELOT_ROUTER are set in your .env file");
}

if (!eclipPair.length || !tiaPair.length) {
  throw new Error("Please ensure ECLIP_PAIR and TIA_PAIR are set correctly in your .env file");
}

// Define the interface for the swap trade
interface SwapTrade {
  amountIn: bigint;
  amountOut: bigint;
  path: Address[];
  adapters: Address[];
  recipients: Address[];
}

// Define the interface for the swap parameters
interface SwapParams {
  trade: SwapTrade;
  fee: bigint;
  to: Address;
}

// ABI for the queryNoSplit function
const queryNoSplitAbi: Abi = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "_amountIn", "type": "uint256" },
      { "internalType": "address", "name": "_tokenIn", "type": "address" },
      { "internalType": "address", "name": "_tokenOut", "type": "address" }
    ],
    "name": "queryNoSplit",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "adapter", "type": "address" },
          { "internalType": "address", "name": "recipient", "type": "address" },
          { "internalType": "address", "name": "tokenIn", "type": "address" },
          { "internalType": "address", "name": "tokenOut", "type": "address" },
          { "internalType": "uint256", "name": "amountOut", "type": "uint256" }
        ],
        "internalType": "struct Query",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Utility function to read private keys from file
export function loadPrivateKeys(filePath: string): string[] {
  const absolutePath = path.resolve(filePath);
  const fileContent = fs.readFileSync(absolutePath, 'utf8');
  return fileContent.split('\n').map(key => key.trim()).filter(key => key.length > 0);
}

// Create a function to get the best amountOut
async function getBestAmountOut(
  client: any, 
  contractAddress: Address, 
  amountIn: bigint, 
  tokenIn: Address, 
  tokenOut: Address
): Promise<bigint> {
  const result = await client.readContract({
    address: contractAddress,
    abi: queryNoSplitAbi,
    functionName: 'queryNoSplit',
    args: [amountIn, tokenIn, tokenOut],
  });

  return BigInt(result.amountOut);
}

// Create a function to perform the swap
export async function swapNoSplitFromETH(
  privateKey: `0x${string}`,
  maxPayEth: bigint,
  path: Address[],
  contractAddress: Address,
  adapters: Address[],
  recipients: Address[]
) {
  // Generate a random amountIn not greater than maxPayEth
  const amountIn = BigInt(Math.floor(Math.random() * Number(maxPayEth))) + 1n;

  // Initialize wallet client
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: arbitrum,
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

  // Initialize public client for reading contract data
  const publicClient = createPublicClient({
    chain: arbitrum,
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

  // Calculate amountOut using queryNoSplit
  const amountOut = await getBestAmountOut(publicClient, contractAddress, amountIn, path[0], path[1]);

  // Define swap parameters
  const swapParams: SwapParams = {
    trade: {
      amountIn,
      amountOut,
      path,
      adapters,
      recipients
    },
    fee: 0n,
    to: account.address as Address
  };

  // ABI for the swap function
  const abi: Abi = [
    {
      "inputs": [
        {
          "components": [
            { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
            { "internalType": "uint256", "name": "amountOut", "type": "uint256" },
            { "internalType": "address[]", "name": "path", "type": "address[]" },
            { "internalType": "address[]", "name": "adapters", "type": "address[]" },
            { "internalType": "address[]", "name": "recipients", "type": "address[]" },
          ],
          "internalType": "struct SwapTrade",
          "name": "_trade",
          "type": "tuple",
        },
        { "internalType": "uint256", "name": "_fee", "type": "uint256" },
        { "internalType": "address", "name": "_to", "type": "address" }
      ],
      "name": "swapNoSplitFromETH",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    }
  ];

  // Encode function data
  const swapData = encodeFunctionData({
    abi,
    functionName: 'swapNoSplitFromETH',
    args: [
      swapParams.trade,
      swapParams.fee,
      swapParams.to
    ]
  });

  // Perform the swap transaction
  const txHash = await walletClient.sendTransaction({
    account,
    to: contractAddress,
    value: swapParams.trade.amountIn,
    data: swapData
  });

  console.log(`🚀 Successfully swapped ${Number(swapParams.trade.amountIn) / 1e18} ETH for ${Number(swapParams.trade.amountOut) / 1e6} tokens for account ${account.address}`);
  console.log(arb_exp+txHash);
}