import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { showcaseDesign } from "@/lib/products/showcase-catalog";
import { ProductView } from "@/components/commerce/product-view";
import { SocialOrderLinks } from "@/components/commerce/social-order-links";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const product = showcaseDesign((await params).slug);
  return { title: product ? `${product.name} | Maison de Moments` : "Design not found", description: product?.description };
}

export default async function DesignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = showcaseDesign(slug);
  if (!product) notFound();
  return <main className="boutique">{product.category === "wedding" && <ProductView slug={slug} />}<header className="boutique-nav"><Link href="/" className="boutique-logo"><span>MM</span>Maison de Moments</Link><nav aria-label="Main navigation"><Link href="/designs">All designs</Link><Link href="/how-to-order">How to order</Link></nav></header>
    <section className="boutique-product"><div className="boutique-product-art" data-image-treatment={product.imageTreatment}><Image src={product.image} alt={`${product.name} artwork preview`} fill priority sizes="(max-width: 850px) 100vw, 50vw" /></div><div className="boutique-product-copy"><Link href="/designs" className="boutique-back"><ArrowLeft size={15} /> All designs</Link><p className="boutique-kicker">{product.categoryLabel} design No. {product.number}</p><h1>{product.name}</h1><p className="boutique-lead">{product.description}</p><p>{product.artworkNote} Names, date, venues, and wording can be personalized with our team.</p><Link href={product.preview} className="boutique-button boutique-button-outline" target="_blank">Experience the full sample <ArrowUpRight size={17} /></Link><small>Fictional sample. Sample replies are not submitted.</small><Link href="/how-to-order" className="boutique-text-link">Interested in this design? See how to order <ArrowUpRight size={16} /></Link></div></section>
    <section className="boutique-intro" id="packages"><p className="boutique-kicker">Personalization possibilities</p><h2>One design, three ways to make it yours.</h2><p>Every invitation is completed by our team. Message us to discuss the right scope, current availability, and pricing.</p></section>
    <section className="boutique-tiers">{(["ESSENTIAL", "SIGNATURE", "COUTURE"] as const).map((tier) => <article key={tier}><p className="boutique-kicker">{tier === "COUTURE" ? "Custom scope" : "Designer guided"}</p><h3>{tier[0] + tier.slice(1).toLowerCase()}</h3><p>{tier === "ESSENTIAL" ? "Your names, event details, words, and supported photos in the original design." : tier === "SIGNATURE" ? "Essential plus a curated palette and compatible decorative choices, arranged by our designer." : "A substantial redesign planned around an agreed brief, deliverables, and timeline."}</p><ul><li><Check size={15} />Designer-finished invitation</li><li><Check size={15} />{product.category === "debut" ? "Personal celebration-circle lists" : "Private household RSVP"}</li><li><Check size={15} />{product.category === "debut" ? "Scope confirmed together by message" : "Review before publishing"}</li></ul><Link href="/how-to-order#contact" className="boutique-button">Ask about {tier[0] + tier.slice(1).toLowerCase()}</Link></article>)}</section>
    <section className="boutique-terms"><p className="boutique-kicker">Ordering is personal</p><h2>Let’s talk about your invitation.</h2><p>Tell us you are interested in {product.name}, along with your event date and location. We will explain options, pricing, availability, and the next steps by message. There is no online checkout or customer portal at this stage.</p><SocialOrderLinks /><Link href="/how-to-order" className="boutique-text-link">Read the full ordering guide <ArrowUpRight size={16} /></Link></section></main>;
}
