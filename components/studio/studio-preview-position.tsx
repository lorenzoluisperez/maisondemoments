"use client";

import { useEffect } from "react";

export function StudioPreviewPosition({ orderId }: { orderId: string }) {
  useEffect(() => {
    const key = `maison-studio-section:${orderId}`;
    const remember = () => {
      const sections = [...document.querySelectorAll<HTMLElement>("main section[id]")];
      const section = sections.filter((item) => item.getBoundingClientRect().top <= 160).at(-1);
      if (section?.id) window.sessionStorage.setItem(key, section.id);
    };
    const restore = async () => {
      await document.fonts.ready;
      const id = window.sessionStorage.getItem(key);
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
    };
    void restore();
    window.addEventListener("pagehide", remember);
    return () => window.removeEventListener("pagehide", remember);
  }, [orderId]);
  return null;
}
