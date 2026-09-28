"use client";

import type { ResolvedMediaAsset } from "@/lib/media/types";

export function ProductGallery({ gallery }: { gallery?: ResolvedMediaAsset[] }) {
  if (!gallery?.length) return null;
  return <section className="product-gallery" aria-labelledby="product-gallery-title"><div className="product-gallery-heading"><p>Moments worth keeping</p><h2 id="product-gallery-title">Our memories</h2></div><div className="product-gallery-grid">{gallery.map((asset) => {
    const largest = asset.sources.at(-1);
    if (!largest) return null;
    return <picture key={asset.mediaId}><source type="image/webp" srcSet={asset.sources.map((source) => `${source.src} ${source.width}w`).join(", ")} sizes="(max-width: 700px) 86vw, 390px" /><img src={largest.src} width={asset.width} height={asset.height} alt={asset.alt} loading="lazy" decoding="async" /></picture>;
  })}</div></section>;
}
