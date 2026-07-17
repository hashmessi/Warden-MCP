import { faker } from "@faker-js/faker";
import { loadLedger, type PaymentRecord } from "../adapters/payment.adapter.js";

export function seedPaymentLedger(): void {
  console.log("[seed:payment] Loading ledger...");

  const janePayments: PaymentRecord[] = [
    {
      id: faker.string.uuid(),
      userId: "jane-placeholder",
      email: "jane.doe@email.com",
      amount: 29.99,
      currency: "USD",
      status: "paid",
      description: "Pro Plan — Monthly",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      subscriptionId: "sub-pro-jane",
    },
    {
      id: faker.string.uuid(),
      userId: "jane-placeholder",
      email: "jane.doe@email.com",
      amount: 9.99,
      currency: "USD",
      status: "paid",
      description: "Storage Add-on — Monthly",
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      subscriptionId: "sub-storage-jane",
    },
  ];

  const syntheticPayments: PaymentRecord[] = Array.from({ length: 150 }, () => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    amount: faker.number.float({ min: 5, max: 200, fractionDigits: 2 }),
    currency: "USD",
    status: faker.helpers.arrayElement(["paid", "refunded", "pending"] as const),
    description: faker.commerce.productName(),
    createdAt: faker.date.past({ years: 1 }).toISOString(),
    subscriptionId: faker.datatype.boolean() ? faker.string.uuid() : undefined,
  }));

  loadLedger([...janePayments, ...syntheticPayments]);
  console.log(`[seed:payment] Loaded ${janePayments.length + syntheticPayments.length} records`);
}
