import { OpenedWallet, openWallet } from "./utils";
import { readdir } from "fs/promises";
import path from "path";
import { updateMetadataFiles, uploadFolderToIPFS } from "./metadata";
import { mintParams, NftCollection } from "./contracts/nftCollection";
import { waitSeqno } from "./deplay";
import { NftItem } from "./contracts/nftItem";
import { NftMarketplace } from "./contracts/nftMarketplace";
import { GetGemsSaleData, NftSale } from "./contracts/nftSale";
import config from "./config";
import { Address, Cell, TonClient, toNano } from "@ton/ton";
import { generateRandomInRange } from "./helpers/getRandomNumber";
import { hexToCell } from "./helpers/hexToCell";
import axios from "axios";
import { sbtItem } from "./contracts/sbtItem";

const metadataFolderPath = path.join(__dirname, "./src/data/metadata/");
const imagesFolderPath = path.join(__dirname, "./src/data/images/");

async function prepareMetadata() {
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
  return metadataIpfsHash;
}

async function deployNftCollection(
  wallet: OpenedWallet,
  metadataIpfsHash: string
) {
  console.log("Start deploy of nft collection...");

  //prepare collection data
  const collectionData = {
    ownerAddress: wallet.contract.address,
    royaltyPercent: 0.05, // 0.05 = 5%
    royaltyAddress: wallet.contract.address,
    nextItemIndex: 40405,
    collectionContentUrl: `https://cf-ipfs.com/ipfs/${metadataIpfsHash}/collection.json`,
    commonContentUrl: `https://cf-ipfs.com/ipfs/${metadataIpfsHash}/`,
  };
  const collection = new NftCollection(collectionData);

  // //deploy collection (Master Contract)
  const seqno = await collection.deploy(wallet);
  console.log(`Collection deployed: ${collection.address}`);
  await waitSeqno(seqno!, wallet);
  console.log(`current seqno: ${seqno}`);

  return collection;
}

async function deployNftItem(
  client: TonClient,
  wallet: OpenedWallet,
  collection: NftCollection
) {
  const files = await readdir(metadataFolderPath);
  files.shift();
  // fill TON Balance for minting NFTs
  let seqno = await collection.topUpBalance(wallet, files.length);
  await waitSeqno(seqno, wallet);
  console.log(`Balance top-upped`);

  console.log(`current seqno: ${seqno}`);

  let collectionData = await NftCollection.getCollectionData(
    client,
    collection.address
  );
  for (let attempt = 0; attempt < 10; attempt++) {
    if (collectionData) {
      break;
    }
    collectionData = await NftCollection.getCollectionData(
      client,
      collection.address
    );
  }

  let itemIndex = collectionData!.nextItemIndex;

  // mint NFTs
  for (const file of files.slice(0, 3)) {
    console.log(`Start deploy of ${itemIndex + 1} NFT`);
    console.log(`NFT Content URL: ${file}`);

    // The queryId in The Open Network (TON) is typically a 64-bit integer
    // which provides a very large range of possible values.
    // The maximum value for a 64-bit unsigned integer is 2^64 − 1 = 18446744073709551615.
    // This means that the queryId can be any integer between 0 and 18446744073709551615, inclusive.
    // but JavaScript's Number type has a maximum safe integer value of 2^53 - 1 (9007199254740991)

    const queryId = generateRandomInRange(1, 9007199254740991);

    const mintParams = {
      queryId,
      itemOwnerAddress: wallet.contract.address,
      itemIndex,
      amount: toNano("0.05"),
      commonContentUrl: file,
      authorityAddress: wallet.contract.address,
    } as mintParams;

    const nftItem = new NftItem(collection);
    seqno = await nftItem.deploy(wallet, mintParams);
    console.log(`Successfully deployed ${itemIndex + 1} NFT`);

    await waitSeqno(seqno, wallet);

    const nftContractAddress = await NftItem.getAddressByIndex(
      client,
      collection.address,
      itemIndex // index of NFT
    );

    console.log(`NFT Contract Address: ${nftContractAddress}`);
    console.log(`current seqno: ${seqno}`);

    await waitSeqno(seqno, wallet, 10000);

    const itemData = await NftItem.getNftItemData(client, nftContractAddress!);
    console.log(`NFT Item Data:`);
    console.log(itemData);

    console.log(`---------------------------------`);

    itemIndex++;
  }
}

async function deployNftSale(
  client: TonClient,
  wallet: OpenedWallet,
  collection: NftCollection,
  index: number
) {
  console.log("Start deploy of new marketplace  ");
  const marketplace = new NftMarketplace(wallet.contract.address);
  let seqno = await marketplace.deploy(wallet);
  await waitSeqno(seqno, wallet);
  console.log("Successfully deployed new marketplace");
  const nftContractAddress = await NftItem.getAddressByIndex(
    client,
    collection.address,
    index // index of NFT
  );

  if (!nftContractAddress) {
    throw new Error("NFT contract address is not found");
  }

  const saleData: GetGemsSaleData = {
    isComplete: false,
    createdAt: Math.ceil(Date.now() / 1000),
    marketplaceAddress: marketplace.address,
    nftAddress: nftContractAddress,
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
  await NftItem.transfer(wallet, nftContractAddress, nftSaleContract.address);
}

// async function editContent(
//   wallet: OpenedWallet,
//   collectionAddress: Address,
//   metadataIpfsHash: string
// ) {
//   const editBody = NftCollection.buildEditContentBody({
//     queryId: generateRandomInRange(1, 5000),
//     collectionContentUrl: `https://cf-ipfs.com/ipfs/${metadataIpfsHash}/collection.json`,
//     commonContentUrl: `https://cf-ipfs.com/ipfs/${metadataIpfsHash}/`,
//     royaltyParams: {
//       royaltyFactor: 100,
//       royaltyBase: 1000,
//       royaltyAddress: wallet.contract.address,
//     },
//   });
//   console.log(editBody);
//   const seqno = await NftCollection.sendEditContent(
//     wallet,
//     collectionAddress,
//     editBody
//   );
//   console.log(`current seqno: ${seqno}`);
// }

async function main() {
  // upload and prepare metadata
  const metadataIpfsHash = await prepareMetadata();

  console.log("initailize wallet.");

  const client = new TonClient({
    endpoint: config.RPCENDPOINT,
    // @ts-ignore
    httpAdapter: async (config) => {
      const data = JSON.parse(config.data);
      if (data.method) {
        config.data = JSON.stringify({
          ...data,
          method: "ton_" + data.method,
        });
      }

      // @ts-ignore
      const r = await axios.defaults.adapter(config);

      const response = JSON.parse(r.data);

      if (response.result) {
        response.ok = true;
      }

      r.data = JSON.stringify(response);

      return r;
    },
  });

  const wallet = await openWallet(client, config.MNEMONIC.split(" "));

  // await editContent(wallet, tonxIdCollectionAddress, metadataIpfsHash);

  // deploy NFT collection
  // const collection = await deployNftCollection(wallet, metadataIpfsHash);

  // get collection data
  // const result = await NftCollection.getCollectionData(
  //   client,
  //   tonxIdCollectionAddress
  // );

  // deploy NFT items
  // await deployNftItem(client, wallet, collection);

  // deploy NFT sale to GetGems
  // deployNftSale();
}

void main();
