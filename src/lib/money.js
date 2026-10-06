export function rupeesToPaise(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("INVALID_AMOUNT");
  }
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error("INVALID_AMOUNT");
  }
  const [intPart, fracPart = ""] = s.split(".");
  const paddedFrac = fracPart.padEnd(2, "0");
  return parseInt(intPart, 10) * 100 + parseInt(paddedFrac, 10);
}

export function paiseToRupees(paise) {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const rem = absPaise % 100;
  const formatted = `${rupees}.${String(rem).padStart(2, "0")}`;
  return isNegative ? `-${formatted}` : formatted;
}

export function percentToBps(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("INVALID_RATE");
  }
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error("INVALID_RATE");
  }
  const [intPart, fracPart = ""] = s.split(".");
  const paddedFrac = fracPart.padEnd(2, "0");
  return parseInt(intPart, 10) * 100 + parseInt(paddedFrac, 10);
}
