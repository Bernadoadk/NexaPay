Exit code: 0
Wall time: 5 seconds
Output:
-- CreateEnum
CREATE TYPE "StoreProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'HIDDEN', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "StoreOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'TRANSFERRING', 'TRANSFERRED', 'FAILED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "ifu" TEXT,
    "rccm" TEXT,
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "quoteLogoUrl" TEXT,
    "quoteLogoPublicId" TEXT,
    "useProfilePhotoAsLogo" BOOLEAN NOT NULL DEFAULT true,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "planExpiresAt" TIMESTAMP(3),
    "planInterval" TEXT NOT NULL DEFAULT 'monthly',
    "aiCredits" INTEGER NOT NULL DEFAULT 0,
    "aiCreditsLastRenewedAt" TIMESTAMP(3),
    "phoneCountry" TEXT DEFAULT 'bj',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "authProvider" TEXT NOT NULL DEFAULT 'email',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "messageHtml" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "fontFamily" TEXT,
    "fontSize" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'dashboard',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "fedapayTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fedapayTxId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "interval" TEXT NOT NULL DEFAULT 'monthly',
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fedapayTxId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "phoneCountry" TEXT DEFAULT 'bj',
    "city" TEXT,
    "address" TEXT,
    "ifu" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0F8F65',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validDays" INTEGER NOT NULL DEFAULT 30,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "paymentUrl" TEXT,
    "paidViaLink" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "themePrimaryColor" TEXT NOT NULL DEFAULT '#0F8F65',
    "themeAccentColor" TEXT NOT NULL DEFAULT '#14201C',
    "themeBackgroundColor" TEXT NOT NULL DEFAULT '#FAFAF7',
    "themeSurfaceColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "themeTextColor" TEXT NOT NULL DEFAULT '#14201C',
    "themeMutedTextColor" TEXT NOT NULL DEFAULT '#6B7570',
    "themeBorderColor" TEXT NOT NULL DEFAULT '#E2E4DF',
    "themeButtonTextColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "themeInputBackgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "themeInputTextColor" TEXT NOT NULL DEFAULT '#14201C',
    "themeInputBorderColor" TEXT NOT NULL DEFAULT '#C8CCC6',
    "themeFontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "whatsapp" TEXT,
    "phone" TEXT,
    "phoneCountry" TEXT DEFAULT 'bj',
    "email" TEXT,
    "momoPhone" TEXT,
    "momoCountry" TEXT DEFAULT 'bj',
    "whatsappCountry" TEXT DEFAULT 'bj',
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "quoteTemplateId" TEXT NOT NULL DEFAULT 'classique',
    "receiptTitle" TEXT NOT NULL DEFAULT 'Reçu d''achat',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "acceptsOrders" BOOLEAN NOT NULL DEFAULT true,
    "paymentMode" TEXT NOT NULL DEFAULT 'ONLINE',
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "imageUrl" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sku" TEXT,
    "status" "StoreProductStatus" NOT NULL DEFAULT 'DRAFT',
    "stock" INTEGER,
    "trackStock" BOOLEAN NOT NULL DEFAULT false,
    "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
    "variantsJson" JSONB,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quoteId" TEXT,
    "status" "StoreOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT NOT NULL,
    "customerPhoneCountry" TEXT DEFAULT 'bj',
    "customerCity" TEXT,
    "customerAddress" TEXT,
    "customerNote" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'ONLINE',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentRef" TEXT,
    "paymentUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeProductId" TEXT,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "imageUrl" TEXT,
    "variantLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StoreOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "fedapayTxId" TEXT,
    "transferId" TEXT,
    "transferredAt" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validDays" INTEGER NOT NULL DEFAULT 30,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplateItem" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "quoteTemplateId" TEXT NOT NULL,

    CONSTRAINT "QuoteTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "fedapayTxId" TEXT,
    "transferId" TEXT,
    "transferredAt" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "FeedbackReview_userId_createdAt_idx" ON "FeedbackReview"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReview_status_createdAt_idx" ON "FeedbackReview"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_fedapayTxId_key" ON "CreditTransaction"("fedapayTxId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPayment_fedapayTxId_key" ON "PlanPayment"("fedapayTxId");

-- CreateIndex
CREATE INDEX "PlanPayment_userId_status_idx" ON "PlanPayment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPayment_fedapayTxId_key" ON "CreditPayment"("fedapayTxId");

-- CreateIndex
CREATE INDEX "CreditPayment_userId_status_idx" ON "CreditPayment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_number_userId_key" ON "Quote"("number", "userId");

-- CreateIndex
CREATE INDEX "QuoteItem_productId_idx" ON "QuoteItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "Store_slug_active_idx" ON "Store"("slug", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Store_userId_key" ON "Store"("userId");

-- CreateIndex
CREATE INDEX "StoreProduct_storeId_status_order_idx" ON "StoreProduct"("storeId", "status", "order");

-- CreateIndex
CREATE INDEX "StoreProduct_productId_idx" ON "StoreProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_quoteId_key" ON "StoreOrder"("quoteId");

-- CreateIndex
CREATE INDEX "StoreOrder_storeId_createdAt_idx" ON "StoreOrder"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "StoreOrder_userId_status_idx" ON "StoreOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "StoreOrder_paymentRef_idx" ON "StoreOrder"("paymentRef");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_number_userId_key" ON "StoreOrder"("number", "userId");

-- CreateIndex
CREATE INDEX "StoreOrderItem_orderId_idx" ON "StoreOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "StoreOrderItem_storeProductId_idx" ON "StoreOrderItem"("storeProductId");

-- CreateIndex
CREATE UNIQUE INDEX "StorePayment_orderId_key" ON "StorePayment"("orderId");

-- CreateIndex
CREATE INDEX "StorePayment_userId_status_idx" ON "StorePayment"("userId", "status");

-- CreateIndex
CREATE INDEX "StorePayment_fedapayTxId_idx" ON "StorePayment"("fedapayTxId");

-- CreateIndex
CREATE INDEX "QuoteTemplate_userId_updatedAt_idx" ON "QuoteTemplate"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "QuoteTemplateItem_quoteTemplateId_idx" ON "QuoteTemplateItem"("quoteTemplateId");

-- CreateIndex
CREATE INDEX "Product_userId_archived_idx" ON "Product"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_quoteId_key" ON "Payment"("quoteId");

-- AddForeignKey
ALTER TABLE "FeedbackReview" ADD CONSTRAINT "FeedbackReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPayment" ADD CONSTRAINT "PlanPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPayment" ADD CONSTRAINT "CreditPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplate" ADD CONSTRAINT "QuoteTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateItem" ADD CONSTRAINT "QuoteTemplateItem_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


