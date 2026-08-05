import { AppError } from "./errors.js";

export function normalizeIndianMobile(input: string) {
  const digits = String(input || "").replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^[6-9]\d{9}$/.test(ten)) {
    throw new AppError("Enter a valid Indian mobile number.", 400, "INVALID_MOBILE");
  }
  return `+91${ten}`;
}

export function normalizeWhatsappDigits(input: string) {
  return normalizeIndianMobile(input).replace("+", "");
}
