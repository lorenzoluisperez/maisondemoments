import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SocialOrderLinks } from "@/components/commerce/social-order-links";

export const metadata = { title: "How to order | Maison de Moments" };

export default function HowToOrderPage() {
  return <main className="boutique">
    <header className="boutique-nav"><Link href="/" className="boutique-logo"><span>MM</span>Maison de Moments</Link><nav aria-label="Main navigation"><Link href="/designs">The designs</Link><Link href="/how-to-order" aria-current="page">How to order</Link></nav></header>
    <section className="boutique-order-hero"><Link href="/designs" className="boutique-back"><ArrowLeft size={15} /> Explore designs</Link><p className="boutique-kicker">Personal, from the first hello</p><h1>How to order</h1><p>Explore the wedding and debut designs and their full samples. When one feels right, send us a message on Facebook or Instagram. We will guide you through the details, availability, pricing, and next steps directly.</p></section>
    <section className="boutique-order-steps" aria-label="Ordering steps">
      <article><span>01</span><h2>Choose a design</h2><p>Browse Garden Romance, Coastal Romance, Heritage Romance, or Pearl & Poise. You can also tell us if you have a different vision in mind.</p></article>
      <article><span>02</span><h2>Send us a message</h2><p>Tell us the design you like, your event date and location, and the kind of personalization you want. A date is enough to start, even if your details are still being finalized.</p></article>
      <article><span>03</span><h2>Plan it together</h2><p>We will confirm availability, explain the scope and price, and tell you what information we need. Nothing is booked or paid for through this website.</p></article>
    </section>
    <section className="boutique-order-contact" id="contact"><p className="boutique-kicker">Ready when you are</p><h2>Start the conversation</h2><p>Message us on either platform. You can copy this note to make the first message easy:</p><blockquote>Hi Maison de Moments! I’m interested in [design name] for a [wedding / debut] on [date] in [location]. Could you share the options, pricing, and availability?</blockquote><SocialOrderLinks /><p className="boutique-order-note">Please do not send sensitive personal details in your first message. We will explain the next steps privately.</p></section>
  </main>;
}
