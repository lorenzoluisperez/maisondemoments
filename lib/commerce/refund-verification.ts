export type ProviderRefund = { id?: string; type?: string; attributes?: {
  status?: string; amount?: number; currency?: string; livemode?: boolean; payment_id?: string;
} };

export function isConfirmedFullRefund(refund: ProviderRefund | undefined, expected: {
  refundId: string; paymentId: string; amountMinor: number; currency: string; live: boolean;
}) {
  return refund?.id === expected.refundId && refund.type === "refund" && refund.attributes?.status === "succeeded" &&
    refund.attributes.livemode === expected.live && refund.attributes.payment_id === expected.paymentId &&
    refund.attributes.amount === expected.amountMinor && refund.attributes.currency === expected.currency;
}
