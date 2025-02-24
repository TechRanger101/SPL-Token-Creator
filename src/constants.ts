const isMainnet = false;

const MAINNET_API_ADDRESS: string = "https://api.mainnet-beta.solana.com";
const DEVNET_API_ADDRESS: string = "https://api.devnet.solana.com";

export const NETWORK = isMainnet ? "mainnet-beta" : "devnet";
export const API_ADDRESS = isMainnet ? MAINNET_API_ADDRESS : DEVNET_API_ADDRESS;
export const CREATOR_KEYPAIR_PATH = "./src/creator-keypair.json";
