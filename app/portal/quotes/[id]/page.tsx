import Link from "next/link";
import { redirect } from "next/navigation";
import { QuoteAcceptance } from "@/components/commerce/quote-acceptance";
import { requireCurrentActor } from "@/lib/auth/current-actor";
import { getCustomerQuote } from "@/lib/commerce/purchases";
import { weddingProduct } from "@/lib/products/catalog";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let quote;
  try { quote = await getCustomerQuote(await requireCurrentActor(), id); }
  catch { redirect(`/login?returnTo=${encodeURIComponent(`/portal/quotes/${id}`)}`); }
  const termsUrl = process.env.COMMERCE_TERMS_URL;
  const cancellationUrl = process.env.COMMERCE_CANCELLATION_URL;
  const taxNotice = process.env.COMMERCE_TAX_NOTICE;
  return <main className="boutique"><header className="boutique-nav"><Link href="/" className="boutique-logo"><span>MM</span>Maison de Moments</Link><nav><Link href="/portal">My invitations</Link></nav></header><section className="commerce-page"><p className="boutique-kicker">A proposal made for you</p><h1>{weddingProduct(quote.productSlug)?.name} Couture</h1><p>Your request: {quote.request}</p>{quote.state === "OFFERED" && quote.priceMinor && quote.scope && quote.exclusions && quote.revisionRounds && quote.deliveryDays ? <><div className="quote-summary"><h2>Included work</h2><p>{quote.scope}</p><h2>Outside this scope</h2><p>{quote.exclusions}</p><p>{quote.revisionRounds} consolidated revision rounds · {quote.deliveryDays} day delivery after complete brief</p><strong>{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(quote.priceMinor / 100)}</strong></div>{termsUrl && cancellationUrl && taxNotice ? <QuoteAcceptance quoteId={quote.id} termsUrl={termsUrl} cancellationUrl={cancellationUrl} taxNotice={taxNotice} /> : <p>Checkout is not available until the service terms and tax details are configured.</p>}</> : <p>{quote.state === "REQUESTED" ? "Our team is preparing your proposal." : `Proposal status: ${quote.state.toLowerCase()}.`}</p>}</section></main>;
}
