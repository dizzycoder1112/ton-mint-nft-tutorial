import * as dotenv from "dotenv";
dotenv.config();

const { PINATA_API_KEY, PINATA_API_SECRET, MNEMONIC, RPCENDPOINT } =
  process.env;

if (!PINATA_API_KEY || !PINATA_API_SECRET || !MNEMONIC || !RPCENDPOINT) {
  throw new Error("Please set all environment variables");
}

const config = {
  PINATA_API_KEY,
  PINATA_API_SECRET,
  MNEMONIC,
  RPCENDPOINT,
};

export default config;
