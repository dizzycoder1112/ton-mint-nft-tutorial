import { openWallet } from "./utils";
import { readdir } from "fs/promises";
import path from "path";
import { Address, toNano } from "ton-core";
import { updateMetadataFiles, uploadFolderToIPFS } from "./metadata";
import { NftCollection } from "./contracts/nftCollection";
import { waitSeqno } from "./deplay";
import { NftItem } from "./contracts/nftItem";
import { NftMarketplace } from "./contracts/nftMarketplace";
import { GetGemsSaleData, NftSale } from "./contracts/nftSale";
import config from "./config";

const metadataFolderPath = path.join(__dirname, "./data/metadata/");
const imagesFolderPath = path.join(__dirname, "./data/images/");
async function init() {
  console.log("Started uploading images to IPFS...");
  const imagesIpfsHash = await uploadFolderToIPFS(imagesFolderPath);
  console.log(
    `Successfully uploaded the pictures to ipfs: https://gateway.pinata.cloud/ipfs/${imagesIpfsHash}`
  );

  console.log("Started uploading metadata files to IPFS...");
  await updateMetadataFiles(metadataFolderPath, imagesIpfsHash);
  const metadataIpfsHash = await uploadFolderToIPFS(metadataFolderPath);
  console.log(
    `Successfully uploaded the metadata to ipfs: https://gateway.pinata.cloud/ipfs/${metadataIpfsHash}`
  );

  // const imagesIpfsHash = "QmTPSH7bkExWcrdXXwQvhN72zDXK9pZzH3AGbCw13f6Lwx";
  // const metadataIpfsHash = "QmeSWKWY3v6fpFVxvLYAa8zXxam5f4cjZijpjYmnBjatzJ";

  // //init wallet

  console.log("initailize wallet.");

  const wallet = await openWallet(config.MNEMONIC.split(" "), true);

  console.log("Start deploy of nft collection...");

  //prepare collection data
  const collectionData = {
    ownerAddress: wallet.contract.address,
    royaltyPercent: 0.05, // 0.05 = 5%
    royaltyAddress: wallet.contract.address,
    nextItemIndex: 0,
    collectionContentUrl: `ipfs://${metadataIpfsHash}/collection.json`,
    commonContentUrl: `ipfs://${metadataIpfsHash}/`,
  };
  const collection = new NftCollection(collectionData);

  // //deploy collection (Master Contract)
  let seqno = await collection.deploy(wallet);
  console.log(`Collection deployed: ${collection.address}`);
  await waitSeqno(seqno!, wallet);

  const files = await readdir(metadataFolderPath);
  // files.pop();
  let index = 0;
  // fill TON Balance for minting NFTs
  seqno = await collection.topUpBalance(wallet, files.length);
  await waitSeqno(seqno, wallet);
  console.log(`Balance top-upped`);

  // mint NFTs
  for (const file of files) {
    console.log(`Start deploy of ${index + 1} NFT`);
    const mintParams = {
      queryId: 0,
      itemOwnerAddress: wallet.contract.address,
      itemIndex: index,
      amount: toNano("0.05"),
      commonContentUrl: file,
    };

    const nftItem = new NftItem(collection);
    seqno = await nftItem.deploy(wallet, mintParams);
    console.log(`Successfully deployed ${index + 1} NFT`);
    await waitSeqno(seqno, wallet);
    index++;
  }

  // console.log("Start deploy of new marketplace  ");
  const marketplace = new NftMarketplace(wallet.contract.address);
  seqno = await marketplace.deploy(wallet);
  await waitSeqno(seqno, wallet);
  console.log("Successfully deployed new marketplace");

  const a = "EQB5xZZNXYsw3nwdVtuU8V3hxCsOTp8emv5tmPOlxX1oaBLW";

  // get NFT address by minting index
  const nftToSaleAddress = await NftItem.getAddressByIndex(
    Address.parse(a),
    0 // index of NFT
  );

  const saleData: GetGemsSaleData = {
    isComplete: false,
    createdAt: Math.ceil(Date.now() / 1000),
    marketplaceAddress: marketplace.address,
    nftAddress: nftToSaleAddress,
    nftOwnerAddress: null,
    fullPrice: toNano("10"),
    marketplaceFeeAddress: wallet.contract.address,
    marketplaceFee: toNano("1"),
    royaltyAddress: wallet.contract.address,
    royaltyAmount: toNano("0.5"),
  };

  const nftSaleContract = new NftSale(saleData);
  seqno = await nftSaleContract.deploy(wallet);
  await waitSeqno(seqno, wallet);
  await NftItem.transfer(wallet, nftToSaleAddress, nftSaleContract.address);
}

void init();

// async function main() {
//   try {
//     const files = await readdir(metadataFolderPath);
//     console.log(files);

//     console.log(files.pop());
//   } catch (e) {
//     console.error(e);
//   }
// }

// void main();
