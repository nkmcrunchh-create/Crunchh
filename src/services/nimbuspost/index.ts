import { env } from "../../config/env.js";
import { MockShippingProvider } from "./mock-provider.js";
import { NimbusPostShippingProvider } from "./nimbuspost-provider.js";
import { ShippingProvider } from "./types.js";

export function getShippingProvider(): ShippingProvider {
  if (env.SHIPPING_PROVIDER === "nimbuspost" && !env.NIMBUSPOST_MOCK_MODE) {
    return new NimbusPostShippingProvider();
  }
  return new MockShippingProvider();
}
