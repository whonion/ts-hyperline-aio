import * as fs from 'fs';
import * as fspath from 'path';
import { bech32 } from 'bech32';

// Delay function using Promise
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility function to read private keys from file
export function loadPrivateKeys(filePath: string): string[] {
  const absolutePath = fspath.resolve(filePath);
  const fileContent = fs.readFileSync(absolutePath, 'utf8');
  return fileContent.split('\n').map(key => {
    key = key.trim();
    if (key.length > 0 && !key.startsWith('0x')) {
      key = '0x' + key;
    }
    return key;
  }).filter(key => key.length > 0);
}
export function bech32ToHex(bech32Address: string): string {
    const decoded = bech32.decode(bech32Address);
    const data = bech32.fromWords(decoded.words);
    const hexAddress = Buffer.from(data).toString('hex');
    return '0x' + hexAddress;
}