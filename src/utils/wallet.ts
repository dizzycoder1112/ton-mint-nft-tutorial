import { KeyPair, mnemonicToPrivateKey } from "@ton/crypto";
import { OpenedContract, TonClient, WalletContractV4 } from "@ton/ton";
import config from "../config";

export type OpenedWallet = {
  contract: OpenedContract<WalletContractV4>;
  keyPair: KeyPair;
};

export async function openWallet(client: TonClient, mnemonic: string[]) {
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const contract = client.open(wallet);
  return { contract, keyPair };
}
