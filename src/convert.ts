import { bech32 } from 'bech32';

export function bech32ToHex(bech32Address: string): string {
    const decoded = bech32.decode(bech32Address);
    const data = bech32.fromWords(decoded.words);
    const hexAddress = Buffer.from(data).toString('hex');
    return '0x' + hexAddress;
}
