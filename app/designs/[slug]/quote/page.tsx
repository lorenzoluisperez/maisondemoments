import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteForm } from "@/components/commerce/quote-form";
import { weddingProduct } from "@/lib/products/catalog";

export default async function QuotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = weddingProduct(slug);
  if (!product) notFound();
  return <main className="boutique"><header className="boutique-nav"><Link href="/" className="boutique-logo"><span>MM</span>Maison de Moments</Link><nav aria-label="Main navigation"><Link href={`/designs/${slug}`}>{product.name}</Link></nav></header><section className="commerce-page"><p className="boutique-kicker">Couture · {product.name}</p><h1>Tell us your vision.</h1><p>A substantial redesign begins with a defined scope. Your request is private and no payment is required yet.</p><QuoteForm slug={slug} /></section></main>;
}
