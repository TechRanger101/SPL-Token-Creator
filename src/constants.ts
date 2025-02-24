const isMainnet = false;

const MAINNET_BUNDLR: string = "https://node1.bundlr.network";
const DEVNET_BUNDLR: string = "https://devnet.bundlr.network";

export const NETWORK = isMainnet ? "mainnet-beta" : "devnet";
export const BUNDLR_ADDRESS = isMainnet ? MAINNET_BUNDLR : DEVNET_BUNDLR;
export const CREATOR_KEYPAIR_PATH = "./src/creator-keypair.json";
