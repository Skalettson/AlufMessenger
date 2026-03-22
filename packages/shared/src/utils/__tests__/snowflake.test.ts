import { describe, it, expect, beforeEach } from 'vitest';
import { initSnowflake, generateSnowflakeId, parseSnowflakeId, snowflakeToString, stringToSnowflake } from '../snowflake';

describe('Snowflake ID Generator', () => {
  beforeEach(() => { initSnowflake(1); });

  it('should generate unique IDs', () => {
    const ids = new Set<bigint>();
    for (let i = 0; i < 1000; i++) ids.add(generateSnowflakeId());
    expect(ids.size).toBe(1000);
  });

  it('should generate monotonically increasing IDs', () => {
    const ids: bigint[] = [];
    for (let i = 0; i < 100; i++) ids.push(generateSnowflakeId());
    for (let i = 1; i < ids.length; i++) expect(ids[i]!).toBeGreaterThan(ids[i - 1]!);
  });

  it('should parse ID back to components', () => {
    const id = generateSnowflakeId();
    const parsed = parseSnowflakeId(id);
    expect(parsed.nodeId).toBe(1);
    expect(parsed.timestamp).toBeInstanceOf(Date);
    expect(parsed.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    expect(parsed.sequence).toBeGreaterThanOrEqual(0);
  });

  it('should convert to/from string', () => {
    const id = generateSnowflakeId();
    const str = snowflakeToString(id);
    expect(typeof str).toBe('string');
    expect(stringToSnowflake(str)).toBe(id);
  });

  it('should throw for invalid node ID', () => {
    expect(() => initSnowflake(-1)).toThrow();
    expect(() => initSnowflake(1024)).toThrow();
  });
});
