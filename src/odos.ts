import { config } from 'dotenv';
import { BSC } from './client';
import { loadPrivateKeys } from './utils';

import { createWalletClient, http, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Load environment variables from .env file
config();

interface QuoteRequestBody {
  chainId: number;
  inputTokens: { tokenAddress: string; amount: string }[];
  outputTokens: { tokenAddress: string; proportion: number }[];
  userAddr: string;
  slippageLimitPercent: number;
  referralCode: number;
  compact: boolean;
}

interface AssembleRequestBody {
  userAddr: string;
  pathId: string;
  simulate: boolean;
}

interface QuoteResponse {
  pathId: string;
  // Other response fields
}

interface AssembleResponse {
  transaction: {
    to: string;
    data: string;
    value: string;
    gas: number;
    gasPrice: string;
    nonce: number;
    chainId: number;
  };
  // Other response fields
}
// Convert MAX_PAY_BNB to a string and parse it as a floating-point number
const MAX_PAY_BNB = parseFloat(process.env.MAX_PAY_BNB || '0.000069420');

// Calculate a random amount no larger than MAX_PAY_BNB
const randomAmount = Math.random() * MAX_PAY_BNB;


const ODOS_API_BASE_URL = 'https://api.odos.xyz/sor';

export async function generateQuote(requestBody: QuoteRequestBody): Promise<QuoteResponse> {
  console.log('Sending request to generate quote...');
  const response = await fetch(`${ODOS_API_BASE_URL}/quote/v2/zap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (response.status === 200) {
    return await response.json();
  } else {
    throw new Error(`Error in Quote: ${response.statusText}`);
  }
}

export async function assembleTransaction(requestBody: AssembleRequestBody): Promise<AssembleResponse> {
  console.log('Sending request to assemble transaction...');
  const response = await fetch(`${ODOS_API_BASE_URL}/assemble`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (response.status === 200) {
    return await response.json();
  } else {
    throw new Error(`Error in Transaction Assembly: ${response.statusText}`);
  }
}

export async function executeTransaction(transaction: any, privateKey: `0x${string}`): Promise<string> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: BSC.chain,
    transport: http(),
  });

  try {
    const adjustedGasLimit = BigInt(Math.ceil(Number(transaction.gas) * 1.5)); // Increase gas limit by 30%
    const txHash = await walletClient.sendTransaction({
      account,
      to: transaction.to as Address,
      data: transaction.data,
      value: BigInt(transaction.value),
      gasLimit: adjustedGasLimit,
      gasPrice: BigInt(transaction.gasPrice),
      nonce: transaction.nonce, // ensure nonce is a number
    });
    return txHash; // return the transaction hash directly
  } catch (error) {
    throw new Error(`Error executing transaction: ${(error as Error).message}`);
  }
}

// Example usage:
(async () => {
  try {
    const privateKeys = loadPrivateKeys('./data/private_keys.txt');

    for (let i = 0; i < privateKeys.length; i++) {
      const rawPrivateKey = privateKeys[i];
      const privateKey = rawPrivateKey.startsWith('0x') ? rawPrivateKey as `0x${string}` : `0x${rawPrivateKey}` as `0x${string}`;
      const account = privateKeyToAccount(privateKey);
      const userAddr = account.address; // Get user address from the private key
      
    console.log('MAX_PAY_BNB:', MAX_PAY_BNB);
    // Attempt to convert MAX_PAY_BNB to a number
    const maxPayBNBNumber = Number(MAX_PAY_BNB);
    if (isNaN(maxPayBNBNumber)) {
      console.error('Error: MAX_PAY_BNB is not a valid number');
      // Handle the error or exit the script if necessary
    }
      // Convert the random amount to a string and then to a BigInt string
      const amountInWei = BigInt(Math.floor(randomAmount * 1e18)).toString();
      const quoteRequestBody: QuoteRequestBody = {
        chainId: 56,
        inputTokens: [
          {
            tokenAddress: '0x0000000000000000000000000000000000000000', // BNB native token address
            amount: amountInWei, // amount of BNB to use for zap-in
          },
        ],
        outputTokens: [
          { tokenAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', proportion: 0.2 }, // USDC
          { tokenAddress: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', proportion: 0.2 }, // ETH
          { tokenAddress: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', proportion: 0.2 }, // BTC
          { tokenAddress: '0x55d398326f99059fF775485246999027B3197955', proportion: 0.2 }, // USDT
          { tokenAddress: '0x37a56cdcd83dce2868f721de58cb3830c44c6303', proportion: 0.2 }, // ZBC
        ],
        userAddr: userAddr,
        slippageLimitPercent: 0.3,
        referralCode: 0,
        compact: true,
      };

      console.log(`Sending request for account ${i + 1} to generate quote...`);
      const quoteResponse = await generateQuote(quoteRequestBody);
      //console.log('Quote Response:', quoteResponse);

      const assembleRequestBody: AssembleRequestBody = {
        userAddr: quoteRequestBody.userAddr,
        pathId: quoteResponse.pathId,
        simulate: true,
      };

      console.log(`Sending request for account ${i + 1} to assemble transaction...`);
      const assembleResponse = await assembleTransaction(assembleRequestBody);
      //console.log('Assemble Response:', assembleResponse);

      console.log(`Executing transaction for account ${i + 1}...`);
      const txHash = await executeTransaction(assembleResponse.transaction, privateKey);
      console.log(`♻️  Successfully swapped ${MAX_PAY_BNB} BNB for target tokens at account ${i + 1}: ${account.address}`);
      console.log(`https://bscscan.com/tx/${txHash}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
})();
