"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, MapPin, Menu, Music2, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import type { WeddingShowcaseFixture } from "@/lib/demo/wedding-showcase";
import styles from "./wedding-showcase.module.css";

const ThreeEnvelope = dynamic(() => import("./three-envelope").then((module) => module.ThreeEnvelope), {
  ssr: false,
  loading: () => null,
});

type OpeningState = "waiting" | "opening" | "handoff" | "intro" | "open";

export function WeddingShowcase({ fixture }: { fixture: WeddingShowcaseFixture }) {
  const rootRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const openingLock = useRef(false);
  const animationStarted = useRef(false);
  const openingTimer = useRef<number | null>(null);
  const [openingState, setOpeningState] = useState<OpeningState>("waiting");
  const [run, setRun] = useState(0);
  const [reset, setReset] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [musicPreferred, setMusicPreferred] = useState(true);
  const [revealMoving, setRevealMoving] = useState(false);
  const [rsvp, setRsvp] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, behavior: "auto" });
    return () => { window.history.scrollRestoration = "auto"; };
  }, []);

  useEffect(() => () => {
    if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
  }, []);

  useEffect(() => {
    if (openingState !== "handoff") return;
    const timer = window.setTimeout(() => setOpeningState("intro"), 2_000);
    return () => window.clearTimeout(timer);
  }, [openingState]);

  useEffect(() => {
    if (openingState !== "intro") return;
    const timer = window.setTimeout(() => setOpeningState("open"), reducedMotion ? 120 : 10_800);
    return () => window.clearTimeout(timer);
  }, [openingState, reducedMotion]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (openingState === "open" || detailsOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [detailsOpen, openingState]);

  useEffect(() => {
    if (!detailsOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setDetailsOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [detailsOpen]);

  useEffect(() => {
    if (openingState !== "open" || reducedMotion) return;
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let dispose: () => void = () => {};
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([gsapModule, triggerModule]) => {
      if (cancelled) return;
      const gsap = gsapModule.gsap;
      const ScrollTrigger = triggerModule.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      const context = gsap.context(() => {
        root.querySelectorAll<HTMLElement>("[data-story-scene]").forEach((section) => {
          const reveals = section.querySelectorAll("[data-reveal]");
          gsap.fromTo(reveals, { autoAlpha: 0, y: 42 }, {
            autoAlpha: 1, y: 0, duration: 1.05, stagger: 0.11, ease: "power3.out",
            scrollTrigger: { trigger: section, start: "top 72%", once: true },
          });
          const art = section.querySelector("[data-scene-art]");
          if (art) gsap.fromTo(art, { scale: 1.08, yPercent: -2 }, {
            scale: 1.015, yPercent: 3, ease: "none",
            scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 0.7 },
          });
        });
      }, root);
      dispose = () => context.revert();
    });
    return () => { cancelled = true; dispose(); };
  }, [openingState, reducedMotion]);

  useEffect(() => {
    const opening = rootRef.current?.querySelector("#opening");
    if (openingState !== "open" || reducedMotion || !opening) return;
    let inView = true;
    const update = () => setRevealMoving(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); });
    observer.observe(opening);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [openingState, reducedMotion]);

  const finishEnvelope = useCallback(() => setOpeningState("handoff"), []);
  const unavailable = useCallback(() => { setFallback(true); setCanvasReady(true); }, []);
  const ready = useCallback(() => setCanvasReady(true), []);

  const openInvitation = useCallback(() => {
    if (openingState !== "waiting" || openingLock.current) return;
    openingLock.current = true;
    setOpeningState("opening");
    if (musicPreferred && audioRef.current) {
      audioRef.current.volume = 0.36;
      void audioRef.current.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    }
    if (reducedMotion) openingTimer.current = window.setTimeout(() => setOpeningState("open"), 120);
    else if (fallback) openingTimer.current = window.setTimeout(finishEnvelope, 2_800);
    else if (canvasReady) {
      animationStarted.current = true;
      setRun((value) => value + 1);
    } else openingTimer.current = window.setTimeout(finishEnvelope, 5_000);
  }, [canvasReady, fallback, finishEnvelope, musicPreferred, openingState, reducedMotion]);

  useEffect(() => {
    if (openingState !== "opening" || !canvasReady || fallback || reducedMotion || animationStarted.current) return;
    if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
    animationStarted.current = true;
    setRun((value) => value + 1);
  }, [canvasReady, fallback, openingState, reducedMotion]);

  useEffect(() => {
    if (openingState !== "opening" || (!fallback && !reducedMotion)) return;
    const timer = window.setTimeout(reducedMotion ? () => setOpeningState("open") : finishEnvelope, reducedMotion ? 120 : 2_800);
    return () => window.clearTimeout(timer);
  }, [fallback, finishEnvelope, openingState, reducedMotion]);

  const skipOpening = useCallback(() => {
    setOpeningState("open");
  }, []);

  const replay = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    openingLock.current = false;
    animationStarted.current = false;
    if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setMusicOn(false);
    setMusicPreferred(true);
    setOpeningState("waiting");
    setReset((value) => value + 1);
  }, []);

  const toggleMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); setMusicOn(true); } catch { setMusicOn(false); }
    } else {
      audio.pause();
      setMusicOn(false);
    }
  }, []);

  const goTo = useCallback((id: string) => {
    if (openingState !== "open") setOpeningState("open");
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }), 20);
  }, [openingState, reducedMotion]);

  const scene = Object.fromEntries(fixture.scenes.map((item) => [item.id, item])) as Record<string, WeddingShowcaseFixture["scenes"][number]>;

  return (
    <main className={`${styles.showcase} ${!revealMoving || reducedMotion ? styles.pauseAmbience : ""}`} ref={rootRef}>
      <audio ref={audioRef} src="/wedding-showcase/there-is-romance.mp3" loop preload="none" />

      {openingState === "open" && <nav className={styles.nav} aria-label="Invitation controls">
        <button className={styles.monogram} onClick={() => goTo("opening")} aria-label="Return to the opening">L <i>&amp;</i> C</button>
        <div className={styles.navActions}>
          <button onClick={replay} className={styles.iconButton} aria-label="Replay envelope opening"><RotateCcw /></button>
          <button onClick={() => void toggleMusic()} className={styles.iconButton} aria-label={musicOn ? "Mute music" : "Play music"}>{musicOn ? <Volume2 /> : <VolumeX />}</button>
          <button onClick={() => setDetailsOpen(true)} className={styles.pillButton} aria-label="Wedding details"><Menu /><span>Details</span></button>
          <button onClick={() => goTo("rsvp")} className={styles.pillButton}>RSVP</button>
        </div>
      </nav>}

      <section id="opening" className={`${styles.opening} ${openingState === "open" ? styles.opened : ""} ${openingState === "opening" || openingState === "handoff" ? styles.openingInMotion : ""}`} aria-label={openingState === "open" ? "Your invitation" : "A sealed envelope"}>
        {(openingState === "intro" || openingState === "open") && <RevealSetting />}
        {(openingState === "waiting" || openingState === "opening" || openingState === "handoff") && (!canvasReady || reducedMotion || fallback) && <StaticEnvelope />}
        {!reducedMotion && !fallback && <div className={styles.canvasWrap} style={{ opacity: canvasReady && (openingState === "waiting" || openingState === "opening" || openingState === "handoff") ? 1 : 0 }} aria-hidden="true"><ThreeEnvelope run={run} reset={reset} active={openingState === "waiting" || openingState === "opening" || openingState === "handoff"} onReady={ready} onComplete={finishEnvelope} onUnavailable={unavailable} /></div>}
        {(openingState === "waiting" || openingState === "opening" || openingState === "handoff") && <>
          <div className={styles.foregroundLeft} aria-hidden="true"><Image src="/wedding-showcase/flowers-ribbon-v3.webp" alt="" fill loading="eager" sizes="(max-width: 700px) 70vw, 40vw" /></div>
          <div className={styles.foregroundRight} aria-hidden="true"><Image src="/wedding-showcase/flowers-ribbon-v3.webp" alt="" fill loading="eager" sizes="(max-width: 700px) 54vw, 30vw" /></div>
        </>}

        {openingState === "waiting" && (
          <>
            <button className={styles.openSurface} onClick={openInvitation} aria-label="Tap the wax seal to open the envelope" />
            <div className={styles.openingUi} aria-hidden="true">
              <p className={styles.tapLabel}>Tap the seal to open</p>
            </div>
            <div className={styles.openingChoices}>
              <button className={styles.soundChoice} onClick={() => setMusicPreferred((value) => !value)} aria-pressed={musicPreferred}>
                <Music2 />{musicPreferred ? "Music on" : "Music off"}
              </button>
              <button className={styles.skipButton} onClick={skipOpening}>Skip opening</button>
            </div>
          </>
        )}

        {openingState === "opening" && <>
          <p className={styles.srOnly} role="status">Opening your envelope…</p>
        </>}

        {openingState === "intro" && <>
          <CinematicIntro date={fixture.dateLabel} />
          <p className={styles.srOnly} role="status">Introducing the wedding of {fixture.couple.first} and {fixture.couple.second}</p>
        </>}

        {(openingState === "handoff" || openingState === "intro") && <div className={`${styles.handoffWash} ${openingState === "intro" ? styles.handoffReveal : ""}`} aria-hidden="true" />}

        {openingState === "open" && (
          <div className={styles.revealCardWrap}><div className={styles.titleCard}>
            <p className={styles.kicker}>{scene.invitation.eyebrow}</p>
            <h1 id="opening-title"><span>{fixture.couple.first}</span><i>&amp;</i><span>{fixture.couple.second}</span></h1>
            <div className={styles.titleRule}><span />{fixture.dateLabel}<span /></div>
            <p>{scene.invitation.copy}</p>
            <button className={styles.scrollCue} onClick={() => goTo("bookshop")}>Begin our story <ChevronDown /></button>
          </div></div>
        )}
        {!canvasReady && !reducedMotion && openingState === "waiting" && <span className={styles.srOnly} role="status">Preparing the three-dimensional invitation</span>}
      </section>

      {openingState === "open" && <>
      <StoryScene id="bookshop" image={scene.bookshop.image!} eyebrow={scene.bookshop.eyebrow} title={scene.bookshop.title} copy={scene.bookshop.copy} align="left" />
      <StoryScene id="proposal" image={scene.proposal.image!} eyebrow={scene.proposal.eyebrow} title={scene.proposal.title} copy={scene.proposal.copy} align="left" warm />
      <StoryScene id="venue" image={scene.venue.image!} eyebrow={scene.venue.eyebrow} title={scene.venue.title} copy={scene.venue.copy} align="right" />

      <section id="celebration" className={styles.celebration} data-story-scene aria-labelledby="celebration-title">
        <div className={styles.paperTexture} />
        <header className={styles.sectionHeader}>
          <p className={styles.kicker} data-reveal>{scene.celebration.eyebrow}</p>
          <h2 id="celebration-title" data-reveal>{scene.celebration.title}</h2>
          <p data-reveal>{scene.celebration.copy}</p>
        </header>
        <Countdown target={fixture.dateIso} />
        <div className={styles.eventGrid}>
          <article data-reveal><span>01</span><p className={styles.kicker}>The ceremony</p><h3>{fixture.ceremony.time}</h3><strong>{fixture.ceremony.venue}</strong><p>{fixture.ceremony.address}</p><a href={fixture.ceremony.mapUrl} target="_blank" rel="noreferrer"><MapPin />View map <ArrowUpRight /></a></article>
          <article data-reveal><span>02</span><p className={styles.kicker}>The reception</p><h3>{fixture.reception.time}</h3><strong>{fixture.reception.venue}</strong><p>{fixture.reception.address}</p></article>
          <article className={styles.dressCard} data-reveal><span>03</span><p className={styles.kicker}>Dress code</p><h3>Garden formal</h3><div className={styles.outfits} aria-hidden="true"><i /><i /><i /></div><div className={styles.swatches}>{fixture.palette.map((color) => <span key={color.name} style={{ background: color.color }} title={color.name} />)}</div><p>A touch of romance in olive, rose, terracotta, or champagne.</p></article>
        </div>
      </section>

      <section id="rsvp" className={styles.rsvp} data-story-scene aria-labelledby="rsvp-title">
        <div className={styles.rsvpPhoto} data-reveal><Image src="/wedding-showcase/villa.webp" alt="Villa Serenità at sunset" fill sizes="(max-width: 700px) 72vw, 340px" /></div>
        <div className={styles.rsvpContent}>
          <p className={styles.kicker} data-reveal>{scene.rsvp.eyebrow} by {fixture.rsvpDeadline}</p>
          <h2 id="rsvp-title" data-reveal>{rsvp ? "Your demo reply is ready" : scene.rsvp.title}</h2>
          {!rsvp ? <>
            <p data-reveal>{scene.rsvp.copy}</p>
            <div className={styles.rsvpActions} data-reveal><button className={styles.primaryButton} onClick={() => setRsvp("yes")}>Joyfully accepts</button><button className={styles.secondaryButton} onClick={() => setRsvp("no")}>Regretfully declines</button></div>
          </> : <div className={styles.confirmation} role="status"><span><Check /></span><p>{rsvp === "yes" ? "We’ll save you a place under the Tuscan stars." : "Your thoughtful reply would be shared with the couple."}</p><small>Demo only. Nothing was submitted.</small><button onClick={() => setRsvp(null)}>Change demo reply</button></div>}
        </div>
      </section>

      <footer className={styles.footer}>
        <p>Same people. A brighter tomorrow.</p><span>L <i>&amp;</i> C</span>
        <small><a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100044" target="_blank" rel="noreferrer">“There Is Romance”</a> by Kevin MacLeod, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</small>
      </footer>
      </>}

      {detailsOpen && <Details fixture={fixture} onClose={() => setDetailsOpen(false)} onRsvp={() => { setDetailsOpen(false); goTo("rsvp"); }} />}
    </main>
  );
}

function RevealSetting() {
  return <div className={styles.revealSetting} aria-hidden="true">
    <div className={styles.revealBackdrop}><Image src="/wedding-showcase/olive-silk.webp" alt="" fill loading="eager" sizes="100vw" /></div>
    <div className={styles.revealLight} />
    <div className={styles.revealFloralLeft}><Image src="/wedding-showcase/flowers-ribbon-v3.webp" alt="" fill sizes="(max-width: 700px) 70vw, 40vw" /></div>
    <div className={styles.revealFloralRight}><Image src="/wedding-showcase/flowers-ribbon-v3.webp" alt="" fill sizes="(max-width: 700px) 70vw, 40vw" /></div>
  </div>;
}

function CinematicIntro({ date }: { date: string }) {
  return <div className={styles.cinematicIntro} aria-hidden="true">
    <div className={styles.introFloralLeft}><Image src="/wedding-showcase/flowers-ribbon-v3.webp" alt="" fill sizes="55vw" /></div>
    <div className={styles.introFloralRight}><Image src="/wedding-showcase/flowers-ribbon-v3.webp" alt="" fill sizes="55vw" /></div>
    <div className={styles.introAura}><i /><i /></div>
    <div className={styles.introRibbons}><i /><i /><i /></div>
    <div className={styles.introPetals}>{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
    <p className={styles.introDate}>{date}</p>
    <div className={styles.introPhrase}>
      <span>Two stories</span>
      <span>One forever</span>
    </div>
    <div className={styles.introMonogram}><span>L</span><i>&amp;</i><span>C</span></div>
    <p className={styles.introOverture}>The wedding of</p>
  </div>;
}

function StoryScene({ id, image, eyebrow, title, copy, align, warm = false }: { id: string; image: string; eyebrow: string; title: string; copy: string; align: "left" | "right"; warm?: boolean }) {
  return <section id={id} className={`${styles.storyScene} ${styles[align]} ${id === "proposal" ? styles.proposal : ""} ${warm ? styles.warm : ""}`} data-story-scene aria-labelledby={`${id}-title`}>
    <div className={styles.sceneArt} data-scene-art><Image src={image} alt="" fill sizes="100vw" /></div><div className={styles.sceneShade} />
    <div className={styles.storyCopy}><p className={styles.kicker} data-reveal>{eyebrow}</p><h2 id={`${id}-title`} data-reveal>{title}</h2><p data-reveal>{copy}</p><span className={styles.chapterMark} data-reveal>Maison de Moments · A New Chapter</span></div>
  </section>;
}

function StaticEnvelope() {
  return <div className={styles.staticEnvelope} aria-hidden="true">
    <Image src="/wedding-showcase/envelope-cotton-v3.webp" alt="" fill priority sizes="100vw" className={styles.envelopePhoto} />
    <div className={styles.staticSeal}><Image src="/wedding-showcase/wax-lc-v3.webp" alt="" fill priority sizes="180px" /></div>
  </div>;
}

function Countdown({ target }: { target: string }) {
  const [parts, setParts] = useState<Array<[string, string]>>([["—", "Days"], ["—", "Hours"], ["—", "Minutes"], ["—", "Seconds"]]);
  useEffect(() => {
    const calculate = () => {
      const distance = Math.max(0, new Date(target).getTime() - Date.now());
      const days = Math.floor(distance / 86_400_000);
      const hours = Math.floor(distance / 3_600_000) % 24;
      const minutes = Math.floor(distance / 60_000) % 60;
      const seconds = Math.floor(distance / 1000) % 60;
      setParts([[String(days), "Days"], [String(hours).padStart(2, "0"), "Hours"], [String(minutes).padStart(2, "0"), "Minutes"], [String(seconds).padStart(2, "0"), "Seconds"]]);
    };
    calculate();
    const interval = window.setInterval(calculate, 1000);
    return () => window.clearInterval(interval);
  }, [target]);
  return <div className={styles.countdown} data-reveal aria-label="Countdown to the wedding">{parts.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

function Details({ fixture, onClose, onRsvp }: { fixture: WeddingShowcaseFixture; onClose: () => void; onRsvp: () => void }) {
  return <div className={styles.detailsBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className={styles.detailsPanel} role="dialog" aria-modal="true" aria-labelledby="details-title"><button className={styles.closeButton} onClick={onClose} aria-label="Close details"><X /></button><p className={styles.kicker}>At a glance</p><h2 id="details-title">Wedding details</h2><dl><div><dt>Date</dt><dd>{fixture.dateLabel}</dd></div><div><dt>Ceremony</dt><dd>{fixture.ceremony.time}<br />{fixture.ceremony.venue}</dd></div><div><dt>Reception</dt><dd>{fixture.reception.time}<br />{fixture.reception.venue}</dd></div><div><dt>Dress code</dt><dd>Garden formal</dd></div></dl><a href={fixture.ceremony.mapUrl} target="_blank" rel="noreferrer" className={styles.secondaryButton}><MapPin />Open map</a><button className={styles.primaryButton} onClick={onRsvp}>Go to RSVP</button></aside></div>;
}
