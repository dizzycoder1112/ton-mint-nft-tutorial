import { Cell } from "@ton/core";

export function hexToCell(hex: string): Cell {
  const bytes = Buffer.from(hex, "hex");
  return Cell.fromBoc(bytes)[0]; // Parse BOC (Bag of Cells) format
}
