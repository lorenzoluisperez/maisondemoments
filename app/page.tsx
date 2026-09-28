import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { weddingProducts } from "@/lib/products/catalog";

export default function HomePage() {
  return <main className="boutique">
    <header className="boutique-nav"><Link href="/" className="boutique-logo"><span>MM</span>Maison de Moments</Link><nav aria-label="Main navigation"><Link href="/designs">The designs</Link><Link href="/portal">My invitation</Link></nav></header>
    <section className="boutique-hero"><div><p className="boutique-kicker">Invitation atelier · Weddings</p><h1>Your story deserves a beautiful beginning.</h1><p>Choose an invitation you love. Tell us the details. Our designers bring it to life, and you approve the final version before guests see it.</p><Link href="/designs" className="boutique-button">Explore the designs <ArrowRight size={17} /></Link></div><div className="boutique-hero-image"><Image src={weddingProducts[0].image} alt="Garden Romance invitation artwork" fill priority sizes="(max-width: 760px) 100vw, 48vw" /></div></section>
    <section className="boutique-intro"><p className="boutique-kicker">Made for a moment that matters</p><h2>Three distinct ways to tell your story</h2><p>Each design is a finished world with its own opening, artwork, and rhythm. Your names, celebration, and words make it yours.</p></section>
    <section className="boutique-grid" aria-label="Wedding invitation designs">{weddingProducts.map((product) => <article className="boutique-card" key={product.slug}><Link href={`/designs/${product.slug}`} className="boutique-art"><Image src={product.image} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" /></Link><div><p className="boutique-kicker">Design No. {product.number}</p><h3>{product.name}</h3><p>{product.setting}</p><Link href={`/designs/${product.slug}`}>Discover the design <ArrowRight size={16} /></Link></div></article>)}</section>
    <section className="boutique-process"><div><span>01</span><h2>Choose</h2><p>Explore each invitation and select the level of customization that suits you.</p></div><div><span>02</span><h2>Make it yours</h2><p>Share your wedding details and photos. A designer prepares your invitation.</p></div><div><span>03</span><h2>Share</h2><p>Approve the exact final version, then manage private guest links and replies.</p></div></section>
    <footer className="boutique-footer"><span>Maison de Moments</span><Link href="/designs">Explore designs</Link><Link href="/login?returnTo=/portal">Customer sign in</Link></footer>
  </main>;
}
