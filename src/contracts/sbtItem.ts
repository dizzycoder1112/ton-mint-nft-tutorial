import { Address, beginCell, Cell } from "@ton/core";

export type SbtItemData = {
  index: number;
  collectionAddress: Address;
  ownerAddress: Address;
  authorityAddress: Address;
  content: string;
  revokedAt?: number;
};

// export type mintParams = {
//   queryId: number | null;
//   amount: bigint;
//   itemIndex: number;
//   itemOwnerAddress: Address;
//   commonContentUrl: string;
//   authorityAddress?: Address; // only available for sbt
// };

export const SbtItemOperationCodes = {
  transfer: 0x5fcc3d14,
  excesses: 0xd53276db,
  getStaticData: 0x2fcb26a2,
  getStaticDataResponse: 0x8b771735,
  EditContent: 0x1a0b9d51,
  TransferEditorship: 0x1c04412a,
  ProveOwnership: 0x04ded148,
  OwnershipProof: 0x0524c7ae,
  OwnershipProofBounced: 0xc18e86d2,
  RequestOwnerInfo: 0xd0c3bfea,
  OwnerInfo: 0x0dd607e3,
  TakeExcess: 0xd136d3b3,
  Destroy: 0x1f04537a,
  Revoke: 0x6f89f5e3,
};

export class sbtItem {
  // static createTransferBody(params: {
  //   queryId?: number;
  //   newOwner: Address | null;
  //   responseTo?: Address;
  //   forwardAmount?: bigint;
  // }): Cell {
  //   const msgBody = beginCell();
  //   msgBody.storeUint(SbtItemOperationCodes.transfer, 32); // op-code
  //   msgBody.storeUint(0, 64); // query-id
  //   msgBody.storeAddress(params.newOwner);

  //   msgBody.storeAddress(params.responseTo || null);
  //   msgBody.storeBit(false); // no custom payload
  //   msgBody.storeCoins(params.forwardAmount || 0);
  //   msgBody.storeBit(0); // no forward_payload
  //   return msgBody.endCell();
  // }

  // public async deploy(
  //   wallet: OpenedWallet,
  //   params: mintParams
  // ): Promise<number> {
  //   const seqno = await wallet.contract.getSeqno();
  //   await wallet.contract.sendTransfer({
  //     seqno,
  //     secretKey: wallet.keyPair.secretKey,
  //     messages: [
  //       internal({
  //         value: "0.05",
  //         to: this.collection.address,
  //         body: this.collection.createMintBody(params),
  //       }),
  //     ],
  //     sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
  //   });
  //   return seqno;
  // }

  static createDestroyBody(params: { queryId?: number }): Cell {
    const msgBody = beginCell();
    msgBody.storeUint(SbtItemOperationCodes.Destroy, 32); // op-code
    msgBody.storeUint(params.queryId || 0, 64); // query-id
    return msgBody.endCell();
  }

  static createMintBody(params: {}) {}

  static createRevokeBody(params: { queryId?: number }): Cell {
    const msgBody = beginCell();
    msgBody.storeUint(SbtItemOperationCodes.Revoke, 32);
    msgBody.storeUint(params.queryId || 0, 64);
    return msgBody.endCell();
  }
}
