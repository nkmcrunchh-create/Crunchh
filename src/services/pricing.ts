import { PaymentMethod, Product } from "@prisma/client";
import { env } from "../config/env.js";
import { shippingSettings } from "../config/business.js";
import { AppError } from "../utils/errors.js";
import { addExclusiveTax, splitInclusiveTax } from "../utils/money.js";

export type PricingCartItem = { productId: string; quantity: number };

export type CalculatedLine = {
  product: Product;
  quantity: number;
  unitPricePaise: number;
  taxRateBps: number;
  lineSubtotalPaise: number;
  lineTaxPaise: number;
  lineTotalPaise: number;
};

export type CalculatedOrder = {
  lines: CalculatedLine[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  totalPaise: number;
};

export function calculateShipping(input: { subtotalPaise: number; state: string; postalCode: string; paymentMethod: PaymentMethod }) {
  if (input.subtotalPaise >= shippingSettings.freeShippingThresholdPaise) return 0;
  const normalizedState = input.state.trim().toLowerCase();
  const ncrByState = shippingSettings.ncrStates.includes(normalizedState);
  const ncrByPin = shippingSettings.ncrPostalCodes.length ? shippingSettings.ncrPostalCodes.includes(input.postalCode) : false;
  if (ncrByState || ncrByPin) {
    return input.paymentMethod === "COD" ? shippingSettings.ncrCodShippingPaise : shippingSettings.ncrPrepaidShippingPaise;
  }
  return shippingSettings.fallbackShippingPaise;
}

export function calculateOrderAmounts(input: {
  products: Product[];
  cartItems: PricingCartItem[];
  paymentMethod: PaymentMethod;
  state: string;
  postalCode: string;
  couponCode?: string | null;
}): CalculatedOrder {
  const bySlugOrId = new Map<string, Product>();
  input.products.forEach((product) => {
    bySlugOrId.set(product.id, product);
    bySlugOrId.set(product.slug, product);
  });

  const lines = input.cartItems.map((item) => {
    const product = bySlugOrId.get(item.productId);
    if (!product) throw new AppError(`Unknown product: ${item.productId}`, 400, "UNKNOWN_PRODUCT");
    if (!product.active) throw new AppError(`${product.name} is currently unavailable.`, 409, "INACTIVE_PRODUCT");
    if (product.inventoryQuantity < item.quantity) throw new AppError(`${product.name} does not have enough stock.`, 409, "INSUFFICIENT_INVENTORY");
    const lineTotalPaise = product.pricePaise * item.quantity;
    const tax = env.TAX_INCLUSIVE_PRICES
      ? splitInclusiveTax(lineTotalPaise, product.taxRateBps)
      : addExclusiveTax(lineTotalPaise, product.taxRateBps);
    return {
      product,
      quantity: item.quantity,
      unitPricePaise: product.pricePaise,
      taxRateBps: product.taxRateBps,
      lineSubtotalPaise: tax.taxablePaise,
      lineTaxPaise: tax.taxPaise,
      lineTotalPaise
    };
  });

  const subtotalPaise = lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);
  const discountPaise = 0;
  const shippingPaise = calculateShipping({
    subtotalPaise: subtotalPaise - discountPaise,
    state: input.state,
    postalCode: input.postalCode,
    paymentMethod: input.paymentMethod
  });
  const shippingTax = env.TAX_INCLUSIVE_PRICES
    ? splitInclusiveTax(shippingPaise, env.SHIPPING_TAX_RATE_BPS)
    : addExclusiveTax(shippingPaise, env.SHIPPING_TAX_RATE_BPS);
  const taxableAmountPaise = lines.reduce((sum, line) => sum + line.lineSubtotalPaise, 0) + shippingTax.taxablePaise - discountPaise;
  const taxPaise = lines.reduce((sum, line) => sum + line.lineTaxPaise, 0) + shippingTax.taxPaise;
  const totalPaise = subtotalPaise - discountPaise + shippingPaise;

  if (input.paymentMethod === "COD") {
    if (!shippingSettings.codEnabled) throw new AppError("COD is currently disabled.", 400, "COD_DISABLED");
    if (totalPaise > shippingSettings.maxCodOrderPaise) throw new AppError("COD is not available for this order value.", 400, "COD_LIMIT");
  }

  return { lines, subtotalPaise, discountPaise, shippingPaise, taxableAmountPaise, taxPaise, totalPaise };
}
