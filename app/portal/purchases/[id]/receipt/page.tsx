import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { getCustomerPaymentConfirmation } from "@/lib/commerce/purchases";

export default async function PaymentConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let confirmation;
  try { confirmation = await getCustomerPaymentConfirmation(await requireCurrentActor(), id); }
  catch (error) {
    if (error instanceof Error && error.message === "Authentication required") redirect(`/login?returnTo=${encodeURIComponent(`/portal/purchases/${id}/receipt`)}`);
    notFound();
  }
  return <main className="boutique"><header className="boutique-nav"><Link href="/" className="boutique-logo"><span>MM</span>Maison de Moments</Link><nav><Link href="/portal">My invitations</Link></nav></header><section className="commerce-page"><p className="boutique-kicker">Payment confirmation</p><h1>{confirmation.refunded ? "Your payment was refunded." : `Thank you, ${confirmation.contactName}.`}</h1><p>{confirmation.refunded ? "PayMongo confirmed a full refund for this purchase. The time it appears in your account depends on your payment method." : `We received the full payment for your ${confirmation.designName} invitation. PayMongo also sends a payment receipt to the email used at checkout.`}</p><dl className="confirmation-details"><div><dt>Design</dt><dd>{confirmation.designName} · {confirmation.tier.toLowerCase()}</dd></div><div><dt>Amount paid</dt><dd>{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(confirmation.amountMinor / 100)}</dd></div><div><dt>Confirmed</dt><dd>{new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(confirmation.paidAt)}</dd></div><div><dt>PayMongo reference</dt><dd>{confirmation.providerPaymentId}</dd></div><div><dt>Purchase</dt><dd>{confirmation.purchaseId}</dd></div></dl><p className="boutique-small">This page confirms the provider payment status in our system. It is not a tax invoice. Contact our team if you require an invoice or need help with the refund.</p>{!confirmation.refunded && <Link className="boutique-button" href={confirmation.jobOrderId ? `/portal?order=${confirmation.jobOrderId}` : `/portal/purchases/${id}`}>Continue your invitation</Link>}</section></main>;
}
