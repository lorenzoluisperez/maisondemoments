import Link from "next/link";

export default function CheckoutReturnPage() {
  return <main className="boutique"><header className="boutique-nav"><Link href="/" className="boutique-logo"><span>MM</span>Maison de Moments</Link></header><section className="commerce-page"><p className="boutique-kicker">Payment status</p><h1>Thank you for choosing us.</h1><p>Your payment is being confirmed. You can see its current status in your private workspace. Please wait for a confirmed receipt before submitting your invitation details.</p><Link href="/portal" className="boutique-button">Open my invitation</Link></section></main>;
}
