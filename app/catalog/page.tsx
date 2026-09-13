import Link from "next/link";
import Image from "next/image";
import { artworkCollections, eventPresets } from "@/lib/invitation/presets";

export default function CatalogPage() {
  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <Link href="/" className="workspace-brand"><span>MM</span><strong>Maison de Moments</strong></Link>
        <div><Link href="/portal">Portal</Link><Link href="/studio">Studio</Link></div>
      </header>
      <section className="catalog-intro">
        <p className="eyebrow">The invitation atelier</p>
        <h1>Stories begin before the celebration.</h1>
        <p>Explore eight structured presets across two original artwork collections. Every experience keeps details and RSVP within immediate reach.</p>
      </section>
      <section className="collection-list">
        {artworkCollections.map((collection) => (
          <article key={collection.id} className="collection-card">
            <div className={`collection-art ${collection.id}`}><Image src={collection.id === "luminous-parchment" ? "/maison-luminous-parchment.webp" : "/maison-botanical.webp"} width="768" height="1152" alt="" /></div>
            <div className="collection-copy">
              <p className="eyebrow">Artwork collection</p><h2>{collection.name}</h2>
              <p>Four event-specific compositions, bound to one released theme and artwork family.</p>
              <div className="preset-links">
                {eventPresets.filter((preset) => preset.collectionId === collection.id).map((preset) => (
                  <Link key={preset.id} href={`/i/${preset.id}-demo`}>{preset.eventType}</Link>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
