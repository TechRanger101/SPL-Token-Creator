import {
  createFungible,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createTokenIfMissing,
  findAssociatedTokenPda,
  getSplAssociatedTokenProgramId,
  mintTokensTo,
} from "@metaplex-foundation/mpl-toolbox";
import {
  generateSigner,
  percentAmount,
  createGenericFile,
  keypairIdentity,
  createSignerFromKeypair,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { base58 } from "@metaplex-foundation/umi/serializers";
import fs from "fs";
import { API_ADDRESS, CREATOR_KEYPAIR_PATH } from "./constants";

/**
 * Function to create and mint fungible tokens.
 *
 * @param {object} params - Parameters for token creation and minting.
 * @param {string} params.tokenName - The name of the token.
 * @param {string} params.tokenSymbol - The symbol of the token.
 * @param {string} params.tokenDescription - A description of the token.
 * @param {string} params.imagePath - Path to the image file for the token.
 * @param {number} params.tokenDecimals - Number of decimals for the token.
 * @param {bigint} params.tokenSupply - Total supply for the token.
 */
const createAndMintTokens = async ({
  tokenName = "Default Token",
  tokenSymbol = "DFT",
  tokenDescription = "Default description",
  imagePath = "./assets/logo.png",
  tokenDecimals = 9,
  tokenSupply = 1_000,
}) => {
  try {
    console.log("Initializing Umi...");

    const umi = createUmi(API_ADDRESS)
      .use(mplTokenMetadata())
      .use(irysUploader());

    console.log("Reading Keypair from path...");
    const keypair = umi.eddsa.createKeypairFromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(CREATOR_KEYPAIR_PATH, "utf8")))
    );
    const umiSigner = createSignerFromKeypair(umi, keypair);
    umi.use(keypairIdentity(umiSigner));

    console.log("Reading image from path...");
    const imageFile = fs.readFileSync(imagePath);

    console.log("Creating generic image file...");
    const umiImageFile = createGenericFile(imageFile, "image.png", {
      tags: [{ name: "Content-Type", value: "image/png" }],
    });

    console.log("Uploading image to Arweave via Irys...");
    const imageUri = await umi.uploader.upload([umiImageFile]);
    console.log(`Image uploaded successfully at: ${imageUri[0]}`);

    console.log("Uploading metadata to Arweave...");
    const metadata = {
      name: tokenName,
      symbol: tokenSymbol,
      description: tokenDescription,
      image: imageUri[0],
    };

    const metadataUri = await umi.uploader.uploadJson(metadata);
    console.log(`Metadata uploaded successfully at: ${metadataUri}`);

    console.log("Generating mint signer...");
    const mintSigner = generateSigner(umi);

    console.log("Creating fungible token...");
    const createFungibleIx = createFungible(umi, {
      mint: mintSigner,
      name: tokenName,
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(0),
      decimals: tokenDecimals,
    });

    console.log(
      "Creating associated token account if missing for the wallet..."
    );
    const createTokenIx = createTokenIfMissing(umi, {
      mint: mintSigner.publicKey,
      owner: umi.identity.publicKey,
      ataProgram: getSplAssociatedTokenProgramId(umi),
    });

    console.log(
      `Minting initial supply of ${tokenSupply} tokens to associated token account...`
    );
    const mintTokensIx = mintTokensTo(umi, {
      mint: mintSigner.publicKey,
      token: findAssociatedTokenPda(umi, {
        mint: mintSigner.publicKey,
        owner: umi.identity.publicKey,
      }),
      amount: tokenSupply * 1_000_000_000,
    });

    console.log("Sending transaction to the blockchain...");
    const tx = await createFungibleIx
      .add(createTokenIx)
      .add(mintTokensIx)
      .sendAndConfirm(umi);

    const signature = base58.deserialize(tx.signature)[0];
    console.log("\nTransaction Completed Successfully!");

    console.log("\n--- Transaction and Token Details ---");
    console.log(`Transaction Signature: ${signature}`);
    console.log(
      `Solana Explorer Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`
    );
    console.log(
      `View Token on Explorer: https://explorer.solana.com/address/${mintSigner.publicKey}?cluster=devnet`
    );
    console.log(
      `Metadata URL: ${metadataUri}\nImage URL: ${imageUri[0]}\nTotal Supply: ${tokenSupply}`
    );
  } catch (error) {
    console.error("Error occurred while creating and minting tokens:", error);
  }
};

// Parameters to customize token creation and minting
const tokenParams = {
  tokenName: "The Club Coin",
  tokenSymbol: "$CLUB",
  tokenDescription:
    "$CLUB Coin is the official currency of the Kurabu ecosystem.",
  imagePath: "./assets/logo.png",
  tokenDecimals: 9,
  tokenSupply: 1_000_000_000,
};

// Execute the main function with token parameters.
createAndMintTokens(tokenParams);
