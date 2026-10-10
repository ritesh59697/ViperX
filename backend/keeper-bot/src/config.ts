import * as dotenv from "dotenv";
dotenv.config();

export const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
export const KEEPER_PRIVATE_KEY = (process.env.KEEPER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;
export const VAULT_ADDRESS = (process.env.VAULT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const ROUTER_ADDRESS = (process.env.ROUTER_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000); // Poll every 5s
