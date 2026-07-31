import { createHash } from "node:crypto";

import type { ChecksumProvider } from "../../application/ports/checksum-provider.js";

export class NodeSha256ChecksumProvider implements ChecksumProvider {
  public async sha256Hex(value: string): Promise<string> {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }
}
