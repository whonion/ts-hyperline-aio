import { createPublicClient, http, Abi, Address,Chain } from 'viem'
import { arbitrum, bsc } from 'viem/chains'

export const Arbitrum = createPublicClient({
  chain: arbitrum,
  transport: http()
})

export const BSC = createPublicClient({
  chain: bsc,
  transport: http()
})
// Define the custom chain configuration for Nautilus
export const nautilusChain: Chain = {
  id: 22222,
  name: 'Nautilus',
  //chain: 'nautilus',
  nativeCurrency: {
    name: 'Nautilus Coin',
    symbol: 'ZBC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://api.nautilus.nautchain.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Nautscan', url: 'https://nautscan.com/mainnet/search/' },
  },
};

export const Nautilus = createPublicClient({
  chain: nautilusChain,
  transport: http()
})

// Define the ABI for the transferRemote function
export const transferRemoteAbi: Abi = [
  {
    "inputs": [
      { "internalType": "uint32", "name": "_destination", "type": "uint32" },
      { "internalType": "bytes32", "name": "_recipient", "type": "bytes32" },
      { "internalType": "uint256", "name": "_amount", "type": "uint256" }
    ],
    "name": "transferRemote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
// Define the ABI for the `Transfer Remote` function from Nautilus
export const TransferRemoteAbiBack: Abi = [
  {
    "inputs": [
      { "internalType": "uint32", "name": "_destination", "type": "uint32" },
      { "internalType": "bytes32", "name": "_recipient", "type": "bytes32" },
      { "internalType": "uint256", "name": "_amount", "type": "uint256" }
    ],
    "name": "Transfer Remote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
// Define the ABI for the approval and transfer functions
export const erc20Abi: Abi = [
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function",
    "stateMutability": "view",
    "payable": false
  },
  {
    "constant": false,
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [
      { "name": "", "type": "bool" }
    ],
    "type": "function",
    "stateMutability": "nonpayable",
    "payable": false
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function",
    "stateMutability": "view",
    "payable": false
  }
];

// ABI for the queryNoSplit function
export const queryNoSplitAbi: Abi = [
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

// Utility function to get token balance
export async function getTokenBalance(client: any, tokenAddress: Address, userAddress: Address): Promise<bigint> {
  const result = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress]
  });
  return BigInt(result);
}

// Utility function to get token decimals
export async function getTokenDecimals(client: any, tokenAddress: Address): Promise<number> {
  const result = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
  });
  return Number(result);
}
