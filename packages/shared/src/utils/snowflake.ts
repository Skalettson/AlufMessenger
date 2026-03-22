const EPOCH = 1735689600000n; // 2025-01-01T00:00:00Z
const NODE_BITS = 10n;
const SEQUENCE_BITS = 12n;
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;

let lastTimestamp = -1n;
let sequence = 0n;
let nodeId = 0n;

export function initSnowflake(node: number): void {
  if (node < 0 || node > 1023) {
    throw new Error('Node ID must be between 0 and 1023');
  }
  nodeId = BigInt(node);
}

export function generateSnowflakeId(): bigint {
  let timestamp = BigInt(Date.now()) - EPOCH;

  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1n) & MAX_SEQUENCE;
    if (sequence === 0n) {
      while (timestamp <= lastTimestamp) {
        timestamp = BigInt(Date.now()) - EPOCH;
      }
    }
  } else {
    sequence = 0n;
  }

  lastTimestamp = timestamp;

  return (timestamp << (NODE_BITS + SEQUENCE_BITS)) | (nodeId << SEQUENCE_BITS) | sequence;
}

export function parseSnowflakeId(id: bigint): { timestamp: Date; nodeId: number; sequence: number } {
  const timestamp = Number((id >> (NODE_BITS + SEQUENCE_BITS)) + EPOCH);
  const node = Number((id >> SEQUENCE_BITS) & ((1n << NODE_BITS) - 1n));
  const seq = Number(id & MAX_SEQUENCE);

  return {
    timestamp: new Date(timestamp),
    nodeId: node,
    sequence: seq,
  };
}

export function snowflakeToString(id: bigint): string {
  return id.toString();
}

export function stringToSnowflake(id: string): bigint {
  return BigInt(id);
}
