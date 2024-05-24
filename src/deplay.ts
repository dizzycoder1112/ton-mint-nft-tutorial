import { OpenedWallet } from "./utils";

export async function waitSeqno(
  seqno: number,
  wallet: OpenedWallet,
  waitMilliSecond: number = 5000
) {
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      await sleep(waitMilliSecond);
      const seqnoAfter = await wallet.contract.getSeqno();
      if (seqnoAfter == seqno + 1) break;
    }
  } catch (error) {
    console.error("Error waiting for seqno", error);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
