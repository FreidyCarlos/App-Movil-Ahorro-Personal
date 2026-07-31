export interface ChecksumProvider {
  sha256Hex(value: string): Promise<string>;
}
