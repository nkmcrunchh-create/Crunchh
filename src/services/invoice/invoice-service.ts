import PDFDocument from "pdfkit";
import { prisma } from "../../db/prisma.js";
import { sellerConfig } from "../../config/business.js";
import { financialYear } from "../../utils/order-id.js";
import { formatPaise } from "../../utils/money.js";
import { AppError, assertApp } from "../../utils/errors.js";
import { getStorageProvider } from "../storage/storage-service.js";

function bufferPdf(build: (doc: PDFKit.PDFDocument) => void) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 42, size: "A4" });
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

async function nextInvoiceNumber() {
  const fy = financialYear();
  const sequence = await prisma.invoiceSequence.upsert({
    where: { financialYear: fy },
    update: { lastNumber: { increment: 1 } },
    create: { financialYear: fy, lastNumber: 1 }
  });
  return { fy, invoiceNumber: `${sellerConfig.invoicePrefix}/${fy}/${String(sequence.lastNumber).padStart(6, "0")}` };
}

export async function generateInvoiceForOrder(orderId: string) {
  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, address: true, items: true, payments: true, shipment: true }
  });
  assertApp(order, "Order not found.", 404, "ORDER_NOT_FOUND");
  assertApp(order.shipment?.awb, "Invoice can only be generated after AWB assignment.", 409, "AWB_REQUIRED");
  assertApp(order.paymentStatus === "CAPTURED" || order.paymentStatus === "COD_PENDING", "Order is not confirmed for invoicing.", 409, "ORDER_NOT_CONFIRMED");

  const { fy, invoiceNumber } = await nextInvoiceNumber();
  const pdf = await bufferPdf((doc) => {
    doc.fontSize(20).text("CRUNCHH Tax Invoice", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Invoice: ${invoiceNumber}`);
    doc.text(`Order: ${order.publicOrderId}`);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`);
    doc.moveDown();
    doc.fontSize(12).text("Seller", { underline: true });
    doc.fontSize(10).text(`${sellerConfig.legalName} (${sellerConfig.brandName})`);
    doc.text(`GSTIN: ${sellerConfig.gstin}`);
    doc.text(`Registered: ${sellerConfig.registeredAddress}`);
    doc.text(`Dispatch: ${sellerConfig.dispatchAddress}`);
    doc.text(`State: ${sellerConfig.state} (${sellerConfig.stateCode})`);
    doc.moveDown();
    doc.fontSize(12).text("Buyer / Shipping", { underline: true });
    doc.fontSize(10).text(order.customer.name);
    doc.text(`${order.address.line1}${order.address.line2 ? `, ${order.address.line2}` : ""}`);
    doc.text(`${order.address.city}, ${order.address.state} - ${order.address.postalCode}`);
    doc.text(`Mobile: ${order.customer.mobile} | Email: ${order.customer.email}`);
    doc.moveDown();
    doc.fontSize(12).text("Items", { underline: true });
    order.items.forEach((item, index) => {
      doc.fontSize(10).text(`${index + 1}. ${item.productNameSnapshot} | SKU ${item.sku} | HSN ${item.hsnSnapshot || "TBD"} | Qty ${item.quantity} | Unit ${formatPaise(item.unitPricePaise)} | Taxable ${formatPaise(item.lineSubtotalPaise)} | Tax ${formatPaise(item.lineTaxPaise)} | Total ${formatPaise(item.lineTotalPaise)}`);
    });
    doc.moveDown();
    doc.text(`Shipping: ${formatPaise(order.shippingPaise)}`);
    doc.text(`Subtotal: ${formatPaise(order.subtotalPaise)}`);
    doc.text(`Tax: ${formatPaise(order.taxPaise)}`);
    doc.fontSize(12).text(`Total: ${formatPaise(order.totalPaise)}`);
    doc.moveDown();
    doc.fontSize(10).text(`Payment: ${order.paymentMethod} | Status: ${order.paymentStatus}`);
    doc.text(`AWB: ${order.shipment?.awb} | Courier: ${order.shipment?.courierName || "TBD"}`);
    doc.moveDown();
    doc.text("Declaration: This development invoice format and tax setup must be checked by the company's accountant before production use.");
    doc.text(`Support: ${sellerConfig.phone} | ${sellerConfig.email}`);
  });

  const storagePath = `invoices/${fy}/${order.publicOrderId}.pdf`;
  const storage = getStorageProvider();
  await storage.putPrivateObject(storagePath, pdf, "application/pdf");
  const pdfUrl = await storage.getSignedUrl(storagePath, 15 * 60);

  return prisma.invoice.create({
    data: {
      orderId: order.id,
      invoiceNumber,
      financialYear: fy,
      pdfStoragePath: storagePath,
      pdfUrl,
      subtotalPaise: order.subtotalPaise,
      taxPaise: order.taxPaise,
      totalPaise: order.totalPaise
    }
  }).catch((error) => {
    throw new AppError(`Invoice creation failed: ${error.message}`, 500, "INVOICE_FAILED");
  });
}
