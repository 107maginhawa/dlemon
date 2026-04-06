# Billing Module

## Overview

The Billing module provides invoice-based payment processing for the Monobase Application Platform. It manages invoices, payment processing, and merchant accounts with Stripe integration, supporting both automatic and manual payment capture flows.

## Key Features

- **Invoice Management**: Create, update, and manage invoices with line items
- **Payment Processing**: Stripe integration for payment collection and refunds
- **Merchant Accounts**: Any person can become a merchant with Stripe Connect
- **Idempotency**: Context field ensures no duplicate invoices
- **Flexible Integration**: Loosely coupled with other modules via invoice references

## Architecture

### Core Concepts

1. **Invoice-Centric Design**: All billing flows through invoices, not embedded in domain objects
2. **Person-Based Merchants**: Any person in the system can have a merchant account
3. **Context Field**: Unique constraint for idempotent invoice creation (e.g., "booking:123")
4. **Stripe Alignment**: Following Stripe's invoice states and payment patterns

### Models

#### Invoice
The core billing entity that tracks payment obligations:
- `customer`: Person who pays (references Person)
- `merchant`: Person who receives payment (references Person)
- `merchantAccount`: Optional Stripe Connect account (found via JOIN on merchant person)
- `context`: Unique identifier for idempotency
- `status`: Draft, Open, Paid, Void, or Uncollectible
- `paymentCaptureMethod`: Automatic or Manual capture
- `lineItems`: Embedded array of invoice items
- `voidThresholdMinutes`: Optional time window for charge protection on void
- `authorizedAt`: Timestamp when payment was authorized
- `authorizedBy`: Person who authorized the payment
- `paidBy`: Person who processed the payment
- `voidedBy`: Person who voided the invoice

#### InvoiceLineItem
Individual items on an invoice:
- `description`: Item description
- `quantity`: Number of units
- `unitPrice`: Price per unit
- `amount`: Total (quantity × unitPrice)
- `metadata`: Flexible tracking (e.g., type: "booking", reference: UUID)

#### MerchantAccount
Stripe Connect wrapper for payment processing:
- `person`: Reference to Person who owns the account
- `active`: Whether account is active
- `metadata`: Stripe-specific data (accountId, onboarding status, etc.)

## API Endpoints

### Invoice Management

- `POST /billing/invoices` - Create invoice
- `GET /billing/invoices/{id}` - Get invoice details
- `PATCH /billing/invoices/{id}` - Update draft invoice
- `DELETE /billing/invoices/{id}` - Delete draft invoice
- `GET /billing/invoices` - List invoices with filters

### Invoice State Transitions

- `POST /billing/invoices/{id}/finalize` - Finalize invoice (draft → open)
- `POST /billing/invoices/{id}/void` - Cancel invoice
- `POST /billing/invoices/{id}/mark-uncollectible` - Mark as uncollectible

### Payment Operations

- `POST /billing/invoices/{id}/pay` - Initiate payment
- `POST /billing/invoices/{id}/capture` - Capture manual payment
- `POST /billing/invoices/{id}/refund` - Process refund

### Merchant Management

- `POST /billing/merchant-accounts` - Create merchant account
- `GET /billing/merchant-accounts/{id}` - Get merchant details
- `POST /billing/merchant-accounts/{id}/onboarding` - Get onboarding URL
- `POST /billing/merchant-accounts/{id}/dashboard` - Get Stripe dashboard login link

### Webhooks

- `POST /billing/webhooks/stripe` - Handle Stripe webhook events

## Integration Patterns

### Service Booking Integration

When creating a paid service booking:

```typescript
// In booking creation handler
if (serviceSchedule.price) {
  const invoice = await billingAPI.createInvoice({
    customer: booking.clientId,
    merchant: serviceProvider.personId,  // Merchant account found via provider.personId
    context: `booking:${booking.id}`, // Prevents duplicates
    total: serviceSchedule.price,
    lineItems: [{
      description: `Service session with ${serviceProvider.name}`,
      unitPrice: serviceSchedule.price,
      quantity: 1,
      metadata: {
        type: "booking",
        reference: booking.id
      }
    }]
  });
  booking.invoice = invoice.id;
}
```

### Idempotency Pattern

The `context` field ensures one invoice per business entity:
- `booking:123` - For service booking payments
- `product:456` - For product purchases
- `subscription:789` - For subscription billing

This prevents double-billing on retries or duplicate requests.

## Invoice States

Following Stripe's model:

1. **Draft**: Invoice being created, can be edited
2. **Open**: Finalized and awaiting payment
3. **Paid**: Successfully paid
4. **Void**: Cancelled before payment
5. **Uncollectible**: Marked as unlikely to be paid

## Payment Flow

### Automatic Capture
1. Create invoice with `paymentCaptureMethod: "automatic"`
2. Call `/pay` endpoint → redirects to Stripe Checkout
3. Payment captured immediately on success
4. Invoice status changes to "paid"

### Manual Capture
1. Create invoice with `paymentCaptureMethod: "manual"`
2. Call `/pay` endpoint → authorizes payment only
3. Later call `/capture` to charge the card
4. Useful for service bookings where service must be completed first

### Void Threshold Protection
For manual capture invoices, merchants can set a `voidThresholdMinutes` to protect against last-minute cancellations:
1. Set `voidThresholdMinutes` when creating the invoice (e.g., 60 minutes)
2. When payment is authorized, `authorizedAt` is recorded
3. If invoice is voided within the threshold window after authorization:
   - Payment is automatically captured before voiding
   - Merchant receives payment for late cancellation
4. If voided outside the threshold or before authorization:
   - Standard void process without charge

## Security Considerations

- All endpoints require authentication
- Merchant account creation limited to person owner
- Payment operations validate ownership
- Stripe webhook uses signature verification
- Sensitive data stored in metadata fields

## Best Practices

1. **Always use context field** for business entity payments
2. **Check invoice status** before attempting payment operations
3. **Handle webhook events** for async payment updates
4. **Store Stripe IDs** in metadata for debugging
5. **Use line item metadata** to track source entities

## Example Usage

### Creating an Invoice

```typescript
const invoice = await createInvoice({
  customer: clientPersonId,
  merchant: serviceProviderPersonId,  // Person ID - merchant account found via JOIN
  context: `booking:${bookingId}`,
  currency: "USD",
  paymentCaptureMethod: "manual",
  voidThresholdMinutes: 60, // Charge if voided within 60 minutes
  lineItems: [{
    description: "Service consultation - 30 minutes",
    quantity: 1,
    unitPrice: 5000, // $50.00 in cents
    metadata: {
      type: "booking",
      reference: bookingId,
      serviceType: "consultation"
    }
  }]
});
```

### Processing Payment

```typescript
// Initiate payment
const paymentResponse = await payInvoice(invoice.id, {
  paymentMethod: "card",
  metadata: { source: "client-portal" }
});

// Redirect user to checkout
window.location.href = paymentResponse.checkoutUrl;

// After service completion, capture payment
await capturePayment(invoice.id);
```

### Handling Refunds

```typescript
const refundResponse = await refundPayment(invoice.id, {
  amount: 2500, // $25.00 partial refund in cents
  reason: "Service quality issue",
  metadata: { approvedBy: adminId }
});
```

## Future Enhancements

- Support for recurring invoices/subscriptions
- Multiple payment methods per invoice
- Partial payments
- Payment plans
- Multi-currency support with automatic conversion
- Enhanced tax calculation and reporting
