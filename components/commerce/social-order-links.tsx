import { orderSocialLinks } from "@/lib/social-order";

function FacebookIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.5v3h2.6v8h3.4Z" /></svg>;
}

function InstagramIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
}

export function SocialOrderLinks() {
  const links = orderSocialLinks();
  return <div className="boutique-social-links" aria-label="Contact us to order">
    {links.facebook ? <a href={links.facebook} target="_blank" rel="noopener noreferrer"><FacebookIcon /> Message us on Facebook</a> : <span aria-label="Facebook link coming soon"><FacebookIcon /> Facebook link coming soon</span>}
    {links.instagram ? <a href={links.instagram} target="_blank" rel="noopener noreferrer"><InstagramIcon /> Message us on Instagram</a> : <span aria-label="Instagram link coming soon"><InstagramIcon /> Instagram link coming soon</span>}
  </div>;
}
