import crypto from "crypto"

export const generateStoreCode = (): string => {
  return `STR-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}