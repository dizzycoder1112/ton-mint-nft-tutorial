import { OpenedWallet } from "../utils";
import { decodeOffChainContent, encodeOffChainContent } from "../helpers";
import { TonClient } from "@ton/ton";
import {
  Address,
  SendMode,
  Builder,
  Cell,
  contractAddress,
  internal,
  beginCell,
  StateInit,
} from "@ton/core";

export type collectionData = {
  ownerAddress: Address; //Address that will be set as owner of our collection. Only owner will be able to mint new NFT
  royaltyPercent: number; //Percent of each sale amount, that will go to the specified address
  royaltyAddress: Address; //Address of wallet, that will receive royalty from sales of this NFT collection
  nextItemIndex: number; //The index that the next NFT item should have
  collectionContentUrl: string; //URL to the collection metadata
  commonContentUrl: string; //Base url for NFT items metadata
};

export type mintParams = {
  queryId: number | null;
  amount: bigint;
  itemIndex: number;
  itemOwnerAddress: Address;
  commonContentUrl: string;
  authorityAddress?: Address; // only available for sbt
};

export type RoyaltyParams = {
  royaltyFactor: number;
  royaltyBase: number;
  royaltyAddress: Address;
};

export type editContentParams = {
  queryId?: number;
  collectionContentUrl: string;
  commonContentUrl: string;
  royaltyParams: RoyaltyParams;
};

// default#_ royalty_factor:uint16 royalty_base:uint16 royalty_address:MsgAddress = RoyaltyParams;
// storage#_ owner_address:MsgAddress next_item_index:uint64
//           ^[collection_content:^Cell common_content:^Cell]
//           nft_item_code:^Cell
//           royalty_params:^RoyaltyParams
//           = Storage;

enum NftDataCellBase64 {
  NFT_ITEM = "te6cckECDQEAAdAAART/APSkE/S88sgLAQIBYgMCAAmhH5/gBQICzgcEAgEgBgUAHQDyMs/WM8WAc8WzMntVIAA7O1E0NM/+kAg10nCAJp/AfpA1DAQJBAj4DBwWW1tgAgEgCQgAET6RDBwuvLhTYALXDIhxwCSXwPg0NMDAXGwkl8D4PpA+kAx+gAxcdch+gAx+gAw8AIEs44UMGwiNFIyxwXy4ZUB+kDUMBAj8APgBtMf0z+CEF/MPRRSMLqOhzIQN14yQBPgMDQ0NTWCEC/LJqISuuMCXwSED/LwgCwoAcnCCEIt3FzUFyMv/UATPFhAkgEBwgBDIywVQB88WUAX6AhXLahLLH8s/Im6zlFjPFwGRMuIByQH7AAH2UTXHBfLhkfpAIfAB+kDSADH6AIIK+vCAG6EhlFMVoKHeItcLAcMAIJIGoZE24iDC//LhkiGOPoIQBRONkchQCc8WUAvPFnEkSRRURqBwgBDIywVQB88WUAX6AhXLahLLH8s/Im6zlFjPFwGRMuIByQH7ABBHlBAqN1viDACCAo41JvABghDVMnbbEDdEAG1xcIAQyMsFUAfPFlAF+gIVy2oSyx/LPyJus5RYzxcBkTLiAckB+wCTMDI04lUC8ANqhGIu",
  SBT_ITEM = "te6ccgECEwEAAzsAART/APSkE/S88sgLAQIBYgIDAgLOBAUCASAPEAS9RsIiDHAJFb4AHQ0wP6QDDwAvhCs44cMfhDAccF8uGV+kAB+GTUAfhm+kAw+GVw+GfwA+AC0x8CcbDjAgHTP4IQ0MO/6lIwuuMCghAE3tFIUjC64wIwghAvyyaiUiC6gGBwgJAgEgDQ4AlDAx0x+CEAUkx64Suo450z8wgBD4RHCCEMGOhtJVA22AQAPIyx8Syz8hbrOTAc8XkTHiyXEFyMsFUATPFlj6AhPLaszJAfsAkTDiAMJsEvpA1NMAMPhH+EHIy/9QBs8W+ETPFhLMFMs/UjDLAAPDAJb4RlADzALegBB4sXCCEA3WB+NANRSAQAPIyx8Syz8hbrOTAc8XkTHiyXEFyMsFUATPFlj6AhPLaszJAfsAAMYy+ERQA8cF8uGR+kDU0wAw+Ef4QcjL//hEzxYTzBLLP1IQywABwwCU+EYBzN6AEHixcIIQBSTHrkBVA4BAA8jLHxLLPyFus5MBzxeRMeLJcQXIywVQBM8WWPoCE8tqzMkB+wAD+o5AMfhByMv/+EPPFoAQcIIQi3cXNUAVUEQDgEADyMsfEss/IW6zkwHPF5Ex4slxBcjLBVAEzxZY+gITy2rMyQH7AOCCEB8EU3pSILrjAoIQb4n141Iguo4WW/hFAccF8uGR+EfAAPLhk/gj+GfwA+CCENE207NSILrjAjAxCgsMAJIx+EQixwXy4ZGAEHCCENUydtsQJFUCbYMGA8jLHxLLPyFus5MBzxeRMeLJcQXIywVQBM8WWPoCE8tqzMkB+wCLAvhkiwL4ZfADAI4x+EQixwXy4ZGCCvrwgHD7AoAQcIIQ1TJ22xAkVQJtgwYDyMsfEss/IW6zkwHPF5Ex4slxBcjLBVAEzxZY+gITy2rMyQH7AAAgghBfzD0UupPywZ3ehA/y8ABhO1E0NM/Afhh+kAB+GNw+GIg10nCAI4Wf/hi+kAB+GTUAfhm+kAB+GXTPzD4Z5Ew4oAA3PhH+Eb4QcjLP/hDzxb4RM8WzPhFzxbLP8ntVIAIBWBESAB28fn+AF8IXwg/CH8InwjQADbVjHgBfCLAADbewfgBfCPA=",
}

enum NftCollectionCellBase64 {
  NFT_COLLECTION = "te6cckECFAEAAh8AART/APSkE/S88sgLAQIBYgkCAgEgBAMAJbyC32omh9IGmf6mpqGC3oahgsQCASAIBQIBIAcGAC209H2omh9IGmf6mpqGAovgngCOAD4AsAAvtdr9qJofSBpn+pqahg2IOhph+mH/SAYQAEO4tdMe1E0PpA0z/U1NQwECRfBNDUMdQw0HHIywcBzxbMyYAgLNDwoCASAMCwA9Ra8ARwIfAFd4AYyMsFWM8WUAT6AhPLaxLMzMlx+wCAIBIA4NABs+QB0yMsCEsoHy//J0IAAtAHIyz/4KM8WyXAgyMsBE/QA9ADLAMmAE59EGOASK3wAOhpgYC42Eit8H0gGADpj+mf9qJofSBpn+pqahhBCDSenKgpQF1HFBuvgoDoQQhUZYBWuEAIZGWCqALnixJ9AQpltQnlj+WfgOeLZMAgfYBwGyi544L5cMiS4ADxgRLgAXGBEuAB8YEYGYHgAkExIREAA8jhXU1DAQNEEwyFAFzxYTyz/MzMzJ7VTgXwSED/LwACwyNAH6QDBBRMhQBc8WE8s/zMzMye1UAKY1cAPUMI43gED0lm+lII4pBqQggQD6vpPywY/egQGTIaBTJbvy9AL6ANQwIlRLMPAGI7qTAqQC3gSSbCHis+YwMlBEQxPIUAXPFhPLP8zMzMntVABgNQLTP1MTu/LhklMTugH6ANQwKBA0WfAGjhIBpENDyFAFzxYTyz/MzMzJ7VSSXwXiN0CayQ==",
  NFT_COLLECTION_EDITABLE_V2 = "te6ccgECFgEAAygAART/APSkE/S88sgLAQIBYgIDAgLNBAUCASAODwL30QY4BIrfAA6GmBgLjYSK3wfSAYAOmP6Z/2omh9IGmfqZBjgOAAShh9IADvAOpqahgqgUEINJ6cqClIXUcUiy+DNgloQQhUZYBWuEAIZGWCqALnixJ9AQpltQnlj+WfgOeLZMAgfYBwKcrjgqnQ44LY+XDIlGAA8YEUYAFAYHAgEgCgsAcDc3NwPTP1MSu/LhklMSugH6ANQwKRA0WfAGjhikUERFFQPIUAbPFhTLPxLMzMwBzxbJ7VSSXwbiAvyOdTc3N3AE1FNQxwHAAJQw0gEwkTHijkUBgED0lm+lJMD/JcABsZMxUlDeII4pCKQggQD6vpPywY/egQGTIaBTJ7vy9AL6ANQwIlRNMPAGJbqTBKQE3gaSbCHisxLmWzNQREUVA8hQBs8WFMs/EszMzAHPFsntVOAowAPjAigICQBQMDY2BoEPoQPHBRLy9AH6QDBUIwVQM8hQBs8WFMs/EszMzAHPFsntVADuwASOIDEyNTU1AdTUMBAlRAMCyFAGzxYUyz8SzMzMAc8Wye1U4DAnwAWOI18GcIAYyMsFUATPFiP6AhPLassfyz+CCvrwgHD7AsmDBvsA4DY3BcAGjhoC+kAwRVAUE8hQBs8WFMs/EszMzAHPFsntVOBfBoQP8vACASAMDQA9Ra8ARwIfAFd4AYyMsFWM8WUAT6AhPLaxLMzMlx+wCAAtAHIyz/4KM8WyXAgyMsBE/QA9ADLAMmAAGz5AHTIywISygfL/8nQgAgEgEBEARbyC32omh9IGmfqZBjgOAAShh9IADvAOpqahgqgS+B6GoYLEAGG4tdMe1E0PpA0z9TIMcBwACUMPpAAd4B1NTUMFUCEDVfBdDUMdQw0HHIywcBzxbMyYAgEgEhMCAWYUFQBNtPR9qJofSBpn6mQY4DgAEoYfSAA7wDqamoYKoEIEq+C+AI4APgCwADyqFe1E0PpA0z9TIMcBwACUMPpAAd4B1NTUMFUCbFEATqrX7UTQ+kDTP1MgxwHAAJQw+kAB3gHU1NQwVQIVXwXQ0w/TD/pAMA==",
}

export const OperationCodes = {
  Mint: 1,
  BatchMint: 2,
  ChangeOwner: 3,
  EditContent: 4,
  GetRoyaltyParams: 0x693d3950,
  GetRoyaltyParamsResponse: 0xa8cb00ad,
};

export class NftCollection {
  private collectionData: collectionData;

  constructor(collectionData: collectionData) {
    this.collectionData = collectionData;
  }

  private createCodeCell(): Cell {
    return Cell.fromBase64(NftCollectionCellBase64.NFT_COLLECTION_EDITABLE_V2);
  }

  private createDataCell(): Cell {
    const data = this.collectionData;
    const dataCell = new Builder();
    dataCell.storeAddress(data.ownerAddress);
    dataCell.storeUint(data.nextItemIndex, 64);

    const contentCell = new Builder();

    const collectionContent = encodeOffChainContent(data.collectionContentUrl);

    const commonContent = new Builder();
    commonContent.storeBuffer(Buffer.from(data.commonContentUrl));

    contentCell.storeRef(collectionContent);
    contentCell.storeRef(commonContent);

    dataCell.storeRef(contentCell);
    const nftItemCodeCell = Cell.fromBase64(NftDataCellBase64.SBT_ITEM);
    dataCell.storeRef(nftItemCodeCell);

    const royaltyCell = new Builder();
    const royaltyBase = 1000;
    const royaltyFactor = Math.floor(data.royaltyPercent * royaltyBase);
    royaltyCell.storeUint(royaltyFactor, 16);
    royaltyCell.storeUint(royaltyBase, 16);
    royaltyCell.storeAddress(data.royaltyAddress);

    dataCell.storeRef(royaltyCell);
    return dataCell.endCell();
  }

  public get stateInit(): StateInit {
    const code = this.createCodeCell();
    const data = this.createDataCell();

    return { code, data };
  }

  public get address(): Address {
    return contractAddress(0, this.stateInit);
  }

  public async deploy(wallet: OpenedWallet) {
    try {
      const seqno = await wallet.contract.getSeqno();
      await wallet.contract.sendTransfer({
        seqno,
        secretKey: wallet.keyPair.secretKey,
        messages: [
          internal({
            value: "0.05",
            to: this.address,
            init: this.stateInit,
          }),
        ],
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      });
      return seqno;
    } catch (error) {
      console.error(error);
    }
  }

  public async topUpBalance(
    wallet: OpenedWallet,
    nftAmount: number
  ): Promise<number> {
    const feeAmount = 0.026; // approximate value of fees for 1 transaction in our case
    const seqno = await wallet.contract.getSeqno();
    const amount = nftAmount * feeAmount;

    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: amount.toString(),
          to: this.address.toString({ bounceable: false }),
          body: new Cell(),
        }),
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });

    return seqno;
  }

  public createMintBody(params: mintParams): Cell {
    const msgBody = new Builder();
    msgBody.storeUint(OperationCodes.Mint, 32);
    msgBody.storeUint(params.queryId || 0, 64);
    msgBody.storeUint(params.itemIndex, 64);
    msgBody.storeCoins(params.amount);

    const itemContent = new Builder();
    itemContent.storeBuffer(Buffer.from(params.commonContentUrl));

    const nftItemMessage = new Builder();
    nftItemMessage.storeAddress(params.itemOwnerAddress);
    if (params.authorityAddress) {
      nftItemMessage.storeAddress(params.authorityAddress);
    }
    nftItemMessage.storeRef(itemContent);

    msgBody.storeRef(nftItemMessage);
    return msgBody.endCell();
  }

  static async getCollectionData(
    client: TonClient,
    collectionAddress: Address
  ) {
    try {
      const response = await client.runMethod(
        collectionAddress,
        "get_collection_data",
        []
      );

      const stack = response.stack;
      const nextItemIndex = stack.readNumber();
      const contentCell = stack.readCell();
      const ownerAddressCell = stack.readCell();
      const ownerAddressSlice = ownerAddressCell.beginParse();
      const content = decodeOffChainContent(contentCell);
      const ownerAddress = ownerAddressSlice.loadAddress();
      return {
        nextItemIndex,
        content,
        ownerAddress,
      };
    } catch (error) {
      console.error("Error getting collection data", error);
      return undefined;
    }
  }

  static async getNftContent(
    client: TonClient,
    collectionAddress: Address,
    nftIndividualContent: Cell
  ) {
    const response = await client.runMethod(
      collectionAddress,
      "get_nft_content",
      [
        { type: "int", value: BigInt(100) },
        {
          type: "cell",
          cell: nftIndividualContent,
        },
      ]
    );
    console.log("response", response);
    console.log("response.stack", response.stack);
    const stack = response.stack;
    const commonContentCell = stack.readCell();
    const commonContent = decodeOffChainContent(commonContentCell);
    console.log("commonContent", commonContent);
  }

  static buildEditContentBody(params: editContentParams) {
    //   editContent: (params: { queryId?: number,  collectionContent: string, commonContent: string,  royaltyParams: RoyaltyParams  }) => {

    // build royalty cell
    const royaltyCellBuilder = beginCell();
    royaltyCellBuilder.storeUint(params.royaltyParams.royaltyFactor, 16);
    royaltyCellBuilder.storeUint(params.royaltyParams.royaltyBase, 16);
    royaltyCellBuilder.storeAddress(params.royaltyParams.royaltyAddress);
    const royaltyCell = royaltyCellBuilder.endCell();

    // build common content cell
    const commonContentCellBuilder = beginCell();
    commonContentCellBuilder.storeBuffer(Buffer.from(params.commonContentUrl));
    const commonContentCell = commonContentCellBuilder.endCell();

    // build content cell
    const contentCellBuilder = beginCell();
    contentCellBuilder.storeRef(
      encodeOffChainContent(params.collectionContentUrl)
    );
    contentCellBuilder.storeRef(commonContentCell);
    const contentCell = contentCellBuilder.endCell();

    // build body cell
    const bodyBuilder = beginCell();
    bodyBuilder.storeUint(OperationCodes.EditContent, 32);
    bodyBuilder.storeUint(params.queryId || 0, 64);
    bodyBuilder.storeRef(contentCell);
    bodyBuilder.storeRef(royaltyCell);

    return bodyBuilder.endCell();
  }

  static async sendEditContent(
    wallet: OpenedWallet,
    collectionAddress: Address,
    msgBody: Cell
  ) {
    const seqno = await wallet.contract.getSeqno();
    await wallet.contract.sendTransfer({
      seqno,
      secretKey: wallet.keyPair.secretKey,
      messages: [
        internal({
          value: "0.05",
          to: collectionAddress,
          body: msgBody,
        }),
      ],
      sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
    });
    //   async sendEditContent(from: Address, msgBody: Cell) {
    //     return await this.contract.sendInternalMessage(new InternalMessage({
    //         to: this.address,
    //         from: from,
    //         value: toNano(1),
    //         bounce: false,
    //         body: new CommonMessageInfo({
    //             body: new CellMessage(msgBody)
    //         })
    //     }))
    // }
  }
}
