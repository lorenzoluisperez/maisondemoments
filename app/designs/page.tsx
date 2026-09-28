import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { weddingProducts } from "@/lib/products/catalog";

export const metadata = { title: "Wedding invitation designs | Maison de Moments" };

export default function DesignsPage() {
  return <main className="boutique"><header className="boutique-nav"><Link href="/" className="boutique-logo"><span>MM</span>Maison de Moments</Link><nav aria-label="Main navigation"><Link href="/">Home</Link><Link href="/portal">My invitation</Link></nav></header>
    <section className="boutique-collection-heading"><p className="boutique-kicker">The wedding collection</p><h1>An invitation as memorable as the day.</h1><p>Discover three finished designs. Preview the full guest experience, then choose how much you would like us to personalize.</p></section>
    <section className="boutique-grid boutique-grid-large">{weddingProducts.map((product) => <article className="boutique-card" key={product.slug}><Link href={`/designs/${product.slug}`} className="boutique-art"><Image src={product.image} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" /></Link><div><p className="boutique-kicker">Wedding design No. {product.number}</p><h2>{product.name}</h2><p>{product.description}</p><Link href={`/designs/${product.slug}`}>View design and packages <ArrowUpRight size={16} /></Link></div></article>)}</section>
    <section className="boutique-next"><p className="boutique-kicker">More celebrations to come</p><h2>Birthdays, debuts, and christenings</h2><p>Our designers are creating new collections. The wedding designs above are the invitations available to explore now.</p></section></main>;
}
