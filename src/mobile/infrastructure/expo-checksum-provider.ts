import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
} from "expo-crypto";

import type { ChecksumProvider } from "../../application/ports/checksum-provider.js";

export class ExpoChecksumProvider implements ChecksumProvider {
  public async sha256Hex(value: string): Promise<string> {
    return digestStringAsync(CryptoDigestAlgorithm.SHA256, value, {
      encoding: CryptoEncoding.HEX,
    });
  }
}
