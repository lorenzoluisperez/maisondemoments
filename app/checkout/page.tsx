import Link from "next/link";
import { CheckoutForm } from "@/components/commerce/checkout-form";
import { getEnabledOffer } from "@/lib/commerce/offers";
import { commerceReady, getCustomerPurchase } from "@/lib/commerce/purchases";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { weddingProduct, type ProductTier } from "@/lib/products/catalog";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ design?: string; tier?: string; purchase?: string }> }) {
  const query = await searchParams;
  const product = weddingProduct(query.design ?? "");
  const tier = query.tier?.toUpperCase() as ProductTier | undefined;
  const offer = product && tier && tier !== "COUTURE" ? await getEnabledOffer(product.slug, tier) : null;
  let existing = null;
  if (query.purchase) {
    try { existing = await getCustomerPurchase(await requireCurrentActor(), query.purchase); } catch { /* Sign-in and ownership are handled by the form. */ }
  }
  const agreedTerms = existing?.termsSnapshot as { termsUrl?: string; cancellationUrl?: string; taxNotice?: string; acceptedAt?: string } | undefined;
  const termsUrl = existing ? agreedTerms?.termsUrl : process.env.COMMERCE_TERMS_URL;
  const cancellationUrl = existing ? agreedTerms?.cancellationUrl : process.env.COMMERCE_CANCELLATION_URL;
  const taxNotice = existing ? agreedTerms?.taxNotice : process.env.COMMERCE_TAX_NOTICE;
  const ready = Boolean(commerceReady() && termsUrl && cancellationUrl && taxNotice);
  return <main className="boutique"><header className="boutique-nav"><Link href="/" className="boutique-logo"><span>MM</span>Maison de Moments</Link><nav aria-label="Main navigation"><Link href="/designs">The designs</Link><Link href="/portal">My invitation</Link></nav></header><section className="commerce-page"><p className="boutique-kicker">Your invitation</p><h1>Let us begin.</h1>
    {existing && existing.status === "AWAITING_PAYMENT" && ready ? <><p>{weddingProduct(existing.productSlug)?.name} · {existing.tier}</p><CheckoutForm slug={existing.productSlug} tier={existing.tier as ProductTier} priceMinor={existing.priceMinor} turnaroundDays={Number((existing.termsSnapshot as { turnaroundDays?: number }).turnaroundDays ?? 0)} termsUrl={termsUrl!} cancellationUrl={cancellationUrl!} taxNotice={taxNotice!} existingPurchaseId={existing.id} /></> :
      product && offer?.priceMinor && offer.turnaroundDays && tier && tier !== "COUTURE" && ready ? <><p>{product.name} · {tier[0] + tier.slice(1).toLowerCase()}</p><CheckoutForm slug={product.slug} tier={tier} priceMinor={offer.priceMinor} turnaroundDays={offer.turnaroundDays} termsUrl={termsUrl!} cancellationUrl={cancellationUrl!} taxNotice={taxNotice!} /></> :
      <><p>This package is not available for checkout yet. Its price and service terms must be finalized first.</p><Link href="/designs" className="boutique-button">Explore designs</Link></>}</section></main>;
}
