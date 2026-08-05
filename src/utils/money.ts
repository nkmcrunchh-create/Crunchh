export function formatPaise(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amountPaise / 100);
}

export function splitInclusiveTax(totalPaise: number, taxRateBps: number) {
  const taxable = Math.round((totalPaise * 10000) / (10000 + taxRateBps));
  return { taxablePaise: taxable, taxPaise: totalPaise - taxable };
}

export function addExclusiveTax(taxablePaise: number, taxRateBps: number) {
  const taxPaise = Math.round((taxablePaise * taxRateBps) / 10000);
  return { taxablePaise, taxPaise, totalPaise: taxablePaise + taxPaise };
}
