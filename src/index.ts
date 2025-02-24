import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
} from "@metaplex-foundation/js";
import {
  DataV2,
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  Connection,
  SystemProgram,
  clusterApiUrl,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
  Cluster,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddress,
  MINT_SIZE,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import fs from "fs";
import { BUNDLR_ADDRESS, CREATOR_KEYPAIR_PATH, NETWORK } from "./constants";

export async function initializeConnection(
  network: Cluster
): Promise<Connection> {
  const connection = new Connection(clusterApiUrl(network), "confirmed");
  console.log(`Connected to cluster: ${network}`);
  return connection;
}

export function loadKeypair(filePath: string): Keypair {
  const secretKey = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

export async function createToken(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey,
  owner: PublicKey,
  decimals: number,
  mintAmount: number
): Promise<PublicKey> {
  const mintKeypair = Keypair.generate();
  const mintKey = mintKeypair.publicKey;

  const requiredBalance = await getMinimumBalanceForRentExemptMint(connection);
  const tokenATA = await getAssociatedTokenAddress(mintKey, owner);

  const createTokenTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKey,
      space: MINT_SIZE,
      lamports: requiredBalance,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mintKey,
      decimals,
      mintAuthority,
      freezeAuthority,
      TOKEN_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      tokenATA,
      owner,
      mintKey
    ),
    createMintToInstruction(
      mintKey,
      tokenATA,
      mintAuthority,
      mintAmount * Math.pow(10, decimals)
    )
  );

  const transactionSignature = await sendAndConfirmTransaction(
    connection,
    createTokenTx,
    [payer, mintKeypair]
  );

  console.log(
    `Create Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  );
  console.log(`Token Address: ${mintKey.toBase58()}`);

  return mintKey;
}

export async function uploadMetadata(
  connection: Connection,
  user: Keypair,
  bundlrAddress: string,
  providerUrl: string,
  imgName: string,
  imagePath: string,
  tokenName: string,
  tokenSymbol: string,
  description: string
): Promise<{ imageUri: string; metadataUri: string }> {
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(user))
    .use(
      bundlrStorage({
        address: bundlrAddress,
        providerUrl,
        timeout: 60000,
      })
    );

  // File to buffer and upload
  const buffer = fs.readFileSync(imagePath);
  const file = toMetaplexFile(buffer, imgName);
  const imageUri = await metaplex.storage().upload(file);
  console.log(`Uploaded Image URI: ${imageUri}`);

  // Upload metadata
  const { uri } = await metaplex.nfts().uploadMetadata({
    name: tokenName,
    symbol: tokenSymbol,
    description,
    image: imageUri,
  });

  console.log(`Uploaded Metadata URI: ${uri}`);

  return { imageUri, metadataUri: uri };
}

export async function createMetadataAccount(
  connection: Connection,
  payer: Keypair,
  mintKey: PublicKey,
  metadataUri: string,
  tokenName: string,
  tokenSymbol: string
): Promise<void> {
  const metadataPDA = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), PROGRAM_ID.toBuffer(), mintKey.toBuffer()],
    PROGRAM_ID
  )[0];

  const tokenMetadata: DataV2 = {
    name: tokenName,
    symbol: tokenSymbol,
    uri: metadataUri,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };

  const transaction = new Transaction().add(
    createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mintKey,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: tokenMetadata,
          isMutable: true,
          collectionDetails: null,
        },
      }
    )
  );

  const transactionSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer]
  );

  console.log(
    `Metadata Account Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  );
  console.log("Metadata PDA:", metadataPDA.toBase58());
}

// Main Function
(async () => {
  try {
    // Configuration Constants
    const IMG_NAME = "logo.png";
    const IMG_PATH = `assets/${IMG_NAME}`;
    const TOKEN_NAME = "Club Coin";
    const TOKEN_SYMBOL = "$CLUB";
    const TOKEN_DESCRIPTION =
      "$CLUB Coin is the official currency of the Kurabu ecosystem.";
    const TOKEN_DECIMAL = 9;
    const MINT_AMOUNT = 10_000_000_000;

    // Initialize Connection
    const connection = await initializeConnection(NETWORK);

    // Load Payer Keypair
    const payer = loadKeypair(CREATOR_KEYPAIR_PATH);
    const mintAuthority = payer.publicKey;
    const freezeAuthority = payer.publicKey;
    const owner = payer.publicKey;

    // Create Token
    const mintKey = await createToken(
      connection,
      payer,
      mintAuthority,
      freezeAuthority,
      owner,
      TOKEN_DECIMAL,
      MINT_AMOUNT
    );

    // Upload Metadata
    const { metadataUri } = await uploadMetadata(
      connection,
      payer,
      BUNDLR_ADDRESS,
      clusterApiUrl(NETWORK),
      IMG_NAME,
      IMG_PATH,
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_DESCRIPTION
    );

    // Create Metadata Account
    await createMetadataAccount(
      connection,
      payer,
      mintKey,
      metadataUri,
      TOKEN_NAME,
      TOKEN_SYMBOL
    );

    console.log("Finished successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
})();
