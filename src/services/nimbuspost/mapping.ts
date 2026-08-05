import { CreateShipmentInput } from "./types.js";

export function mapCrunchhShipmentToNimbusPost(input: CreateShipmentInput) {
  return {
    order_number: input.publicOrderId,
    consignee_name: input.customer.name,
    consignee_address: [input.address.line1, input.address.line2, input.address.landmark].filter(Boolean).join(", "),
    consignee_city: input.address.city,
    consignee_state: input.address.state,
    consignee_pincode: input.address.postalCode,
    consignee_mobile: input.customer.mobile,
    consignee_email: input.customer.email,
    payment_type: input.paymentMethod === "COD" ? "cod" : "prepaid",
    cod_amount: input.codAmountPaise / 100,
    declared_value: input.declaredValuePaise / 100,
    product_name: input.items.map((item) => item.name).join(", "),
    sku: input.items.map((item) => item.sku).join(","),
    quantity: input.items.reduce((sum, item) => sum + item.quantity, 0),
    total_weight_kg: input.totalWeightGrams / 1000,
    length_cm: input.dimensions.lengthCm,
    width_cm: input.dimensions.widthCm,
    height_cm: input.dimensions.heightCm,
    pickup_location_id: process.env.NIMBUSPOST_PICKUP_LOCATION_ID,
    return_location_id: process.env.NIMBUSPOST_RETURN_LOCATION_ID,
    courier_id: input.courierId
  };
}
