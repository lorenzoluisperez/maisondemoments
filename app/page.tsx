import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { showcaseDesigns } from "@/lib/products/showcase-catalog";

export default function HomePage() {
  return <main className="boutique">
    <header className="boutique-nav"><Link href="/" className="boutique-logo"><span>MM</span>Maison de Moments</Link><nav aria-label="Main navigation"><Link href="/designs">The designs</Link><Link href="/how-to-order">How to order</Link></nav></header>
    <section className="boutique-hero"><div><p className="boutique-kicker">Invitation atelier · Weddings & Debuts</p><h1>Your story deserves a beautiful beginning.</h1><p>Explore our interactive wedding and debut invitations. When you find a design you love, message us on Facebook or Instagram to ask about personalization, pricing, and availability.</p><Link href="/designs" className="boutique-button">Explore the designs <ArrowRight size={17} /></Link><Link href="/how-to-order" className="boutique-text-link">See how to order <ArrowRight size={16} /></Link></div><div className="boutique-hero-image"><Image src={showcaseDesigns[0].image} alt="Garden Romance invitation artwork" fill priority sizes="(max-width: 760px) 100vw, 48vw" /></div></section>
    <section className="boutique-intro"><p className="boutique-kicker">Made for a moment that matters</p><h2>Beautiful beginnings, unforgettable chapters</h2><p>Each design is a finished world with its own opening, artwork, and rhythm. Your names, celebration, and words make it yours.</p></section>
    <section className="boutique-grid" aria-label="Wedding and debut invitation designs">{showcaseDesigns.map((product) => <article className="boutique-card" key={product.slug}><Link href={`/designs/${product.slug}`} className="boutique-art" aria-label={`View ${product.name} design`} data-image-treatment={product.imageTreatment}><Image src={product.image} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" /></Link><div><p className="boutique-kicker">{product.categoryLabel} design No. {product.number}</p><h3>{product.name}</h3><p>{product.setting}</p><Link href={`/designs/${product.slug}`}>Discover the design <ArrowRight size={16} /></Link></div></article>)}</section>
    <section className="boutique-process"><div><span>01</span><h2>Explore</h2><p>View the wedding and debut designs and experience each fictional sample.</p></div><div><span>02</span><h2>Message us</h2><p>Tell us your favorite design, event date, and location on Facebook or Instagram.</p></div><div><span>03</span><h2>Plan together</h2><p>We will discuss availability, personalization, pricing, and the next steps with you.</p></div><Link href="/how-to-order" className="boutique-button">How to order <ArrowRight size={17} /></Link></section>
    <footer className="boutique-footer"><span>Maison de Moments</span><Link href="/designs">Explore designs</Link><Link href="/how-to-order">How to order</Link></footer>
  </main>;
}
