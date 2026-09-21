# Online rent payments

PGConnect uses Razorpay Standard Checkout. Each PG owner connects their own merchant account in **Settings → Payments**, so rent is collected by that account. PGConnect does not collect or store card numbers, UPI PINs, or bank credentials.

## Owner setup

1. Activate a Razorpay merchant account approved for your PG business and complete the provider's verification requirements. Confirm the account's settlement details directly in Razorpay.
2. Enable automatic payment capture in the Razorpay dashboard.
3. In PGConnect, open **Settings → Payments** and enter the live key ID and key secret. Choose a separate webhook secret of at least 32 characters and retain it in your password manager.
4. Confirm that the merchant account is the intended recipient for this property, then connect it.
5. Copy the generated webhook URL into Razorpay's webhook settings. Use the same webhook secret and enable `payment.captured`, `payment.authorized`, and `payment.refunded`.
6. Tenants can now open **My dues & payments → Pay rent**. Available payment methods and fees depend on the merchant account. There are no application-level payment surcharges.

Live keys are required on the deployed production website. Test keys are accepted only by a development server, to prevent simulated payments from settling real rent records. No merchant account has been connected as part of implementation. The owner must complete the setup; no real payment has been charged during verification.

## Confirmation and recovery

The server loads the tenant's own rent record and calculates the amount in paise. It reserves one durable order per rent before creating the Razorpay order. Retries reuse that order. Provider order/payment IDs have unique constraints. Both checkout callbacks and signed webhooks fetch the current payment from Razorpay and require the exact order, amount, INR currency, captured status, and no refund before marking rent paid. Authorization alone does not count as payment.

Use **Check payment status** if checkout closes unexpectedly, a payment remains pending, or a webhook is delayed. Owners can also check status from Rent & dues. The server can recover an order after a network timeout using its unique receipt. If the provider never created a recoverable order, the record stays locked for manual investigation instead of risking a duplicate charge. A definite provider rejection releases the uncreated local reservation for a corrected retry.

Once an online order exists, the owner cannot overwrite its payment state with the offline-payment toggle. Provider-confirmed payments and dashboard mutations share a database lock/revision check, preventing stale dashboard writes from reverting a payment.

Provider refunds are flagged **Needs review** and removed from the paid rent total. They do not automatically create a new charge. Refunds and disputes must be handled in the Razorpay dashboard; this version does not initiate refunds, issue partial-rent invoices, split payouts, or automate recurring debits. Resolve a flagged refund with the tenant before an administrator adjusts the ledger. Preserve the original provider payment reference.

Account replacement is blocked while orders remain unresolved. Historical encrypted account credentials remain available for verification of their original orders. Never delete old provider keys or change the application encryption key without a migration/reconciliation plan.

## Security and validation

- Only the property's authenticated owner can configure its merchant account. Secrets are AES-256-GCM encrypted in Neon and never returned by settings/dashboard APIs.
- Tenant checkout and verification are scoped to the signed-in tenant and property; browser-supplied amounts are ignored.
- Browser API mutations require the configured Origin and JSON body; webhook requests use raw-body HMAC verification instead of cookies.
- Signatures use timing-safe comparison. Requests are size-limited and payment APIs rate-limited.
- CSP permits Razorpay's checkout script and frames while retaining the app's other restrictions.
- The provider adapter always calls the fixed official Razorpay API origin, with bounded request timeouts.

Validation commands (local PostgreSQL only for the integration script):

```powershell
npm test
node --env-file=.env --import tsx tests/payment-integration.ts
npm run typecheck
npm run lint
npm run build
```

The integration script mocks all Razorpay responses, creates temporary local fixtures, verifies authorization, encryption, captured-payment requirements, callback/webhook signatures, duplicate delivery, concurrent order creation, stale writes, refund flags, and order recovery, then removes its fixtures. A full Razorpay checkout test with merchant test credentials remains necessary before the owner enables live payments.

Provider references: [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/), and [Orders API](https://github.com/razorpay/razorpay-node/blob/master/documents/order.md).
