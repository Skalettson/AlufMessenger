export declare function initSnowflake(node: number): void;
export declare function generateSnowflakeId(): bigint;
export declare function parseSnowflakeId(id: bigint): {
    timestamp: Date;
    nodeId: number;
    sequence: number;
};
export declare function snowflakeToString(id: bigint): string;
export declare function stringToSnowflake(id: string): bigint;
//# sourceMappingURL=snowflake.d.ts.map