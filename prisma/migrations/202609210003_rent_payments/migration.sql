CREATE TABLE "PaymentAccount" (
  "id" TEXT NOT NULL, "propertyId" TEXT NOT NULL, "keyId" TEXT NOT NULL,
  "secretEncrypted" TEXT NOT NULL, "webhookSecretEncrypted" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAccount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PaymentAccount_propertyId_enabled_idx" ON "PaymentAccount"("propertyId", "enabled");
CREATE UNIQUE INDEX "PaymentAccount_one_active_per_property" ON "PaymentAccount"("propertyId") WHERE "enabled" = true;
CREATE TABLE "PaymentOrder" (
  "id" TEXT NOT NULL, "rentId" TEXT NOT NULL, "accountId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'INR',
  "providerOrderId" TEXT, "providerPaymentId" TEXT, "status" TEXT NOT NULL DEFAULT 'CREATING',
  "capturedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentOrder_rentId_fkey" FOREIGN KEY ("rentId") REFERENCES "Rent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentOrder_amount_positive" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "PaymentOrder_rentId_key" ON "PaymentOrder"("rentId");
CREATE UNIQUE INDEX "PaymentOrder_providerOrderId_key" ON "PaymentOrder"("providerOrderId");
CREATE UNIQUE INDEX "PaymentOrder_providerPaymentId_key" ON "PaymentOrder"("providerPaymentId");
