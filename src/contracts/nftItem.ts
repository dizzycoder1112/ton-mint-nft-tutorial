import {
  Address,
  beginCell,
  Cell,
  internal,
  SendMode,
  toNano,
} from "@ton/core";
import { OpenedWallet } from "../utils";
import { NftCollection, mintParams } from "./nftCollection";
import { TonClient } from "@ton/ton";

export type NftItemData = {
  index: number;
  collectionAddress: Address | null;
  ownerAddress: Address;
  content: string;
};

export const NftItemOperationCodes = {
  transfer: 0x5fcc3d14,
  getStaticData: 0x2fcb26a2,
  getStaticDataResponse: 0x8b771735,
  GetRoyaltyParams: 0x693d3950,
  GetRoyaltyParamsResponse: 0xa8cb00ad,
  EditContent: 0x1a0b9d51,
  TransferEditorship: 0x1c04412a,
};

export class NftItem {
  private collection: NftCollection;

  constructor(collection: NftCollection) {
    this.collection = collection;
  }

  public async deploy(
    wallet: OpenedWallet,
    params: mintParams
  ): Promise<number> {
    const seqno = await wallet.contract.getSeqno();
    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: "0.05",
          to: this.collection.address,
          body: this.collection.createMintBody(params),
        }),
      ],
      sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
    });
    return seqno;
  }

  static async getAddressByIndex(
    client: TonClient,
    collectionAddress: Address,
    itemIndex: number
  ) {
    try {
      const response = await client.runMethod(
        collectionAddress,
        "get_nft_address_by_index",
        [{ type: "int", value: BigInt(itemIndex) }]
      );
      return response.stack.readAddress();
    } catch (error) {
      console.error("Error getting NFT address by index", error);
    }
  }

  static async getNftItemData(client: TonClient, nftItemAddress: Address) {
    try {
      const response = await client.runMethod(
        nftItemAddress,
        "get_nft_data",
        []
      );
      const stack = response.stack;
      const init = stack.readNumber();
      const index = stack.readNumber();
      const collectionAddress = stack.readAddress();
      const ownerAddress = stack.readAddress();
      const content = stack.readString();
      return { init, index, collectionAddress, ownerAddress, content };
    } catch (error) {
      console.error("Error getting NFT item data", error);
    }
  }

  static createTransferBody(params: {
    newOwner: Address;
    responseTo?: Address;
    forwardAmount?: bigint;
  }): Cell {
    const msgBody = beginCell();
    msgBody.storeUint(NftItemOperationCodes.transfer, 32); // op-code
    msgBody.storeUint(0, 64); // query-id
    msgBody.storeAddress(params.newOwner);

    msgBody.storeAddress(params.responseTo || null);
    msgBody.storeBit(false); // no custom payload
    msgBody.storeCoins(params.forwardAmount || 0);
    msgBody.storeBit(0); // no forward_payload

    return msgBody.endCell();
  }

  static async transfer(
    wallet: OpenedWallet,
    nftAddress: Address,
    newOwner: Address
  ): Promise<number> {
    const seqno = await wallet.contract.getSeqno();

    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: "0.05",
          to: nftAddress,
          body: this.createTransferBody({
            newOwner,
            responseTo: wallet.contract.address,
            forwardAmount: toNano("0.02"),
          }),
        }),
      ],
      sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
    });
    return seqno;
  }
}
