"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Check, Menu, Music2, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import type { WeddingShowcaseFixture } from "@/lib/demo/wedding-showcase";
import { BeachEnvelope } from "./beach-envelope";
import styles from "./beach-wedding-showcase.module.css";

type Chapter = WeddingShowcaseFixture["scenes"][number];
type OpeningState = "sealed" | "opening" | "overture" | "revealed";
const surfSequence = [0, 1, 2, 1, 0, 3];
const surfImages = ["shoreline-watercolor.webp", "surf-frame-2.webp", "surf-frame-3.webp", "surf-frame-4.webp"];

function PaintedSurfFrames({ reducedMotion }: { reducedMotion: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) setStep((current) => (current + 1) % surfSequence.length);
    }, 2_400);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);
  const active = surfSequence[step];
  return <div className={styles.paintedSurf} aria-hidden="true">
    {surfImages.map((file, index) => <div key={file} className={`${styles.surfFrame} ${index === active ? styles.surfFrameActive : ""}`} data-surf-frame={index} style={{ backgroundImage: `url(/beach-wedding/${file})` }} />)}
  </div>;
}

export function BeachWeddingShowcase({ fixture }: { fixture: WeddingShowcaseFixture }) {
  const [openingState, setOpeningState] = useState<OpeningState>("sealed");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reply, setReply] = useState<"yes" | "no" | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [musicPreferred, setMusicPreferred] = useState(true);
  const [envelopeReady, setEnvelopeReady] = useState(false);
  const [envelopeFailed, setEnvelopeFailed] = useState(false);
  const [wordsStarted, setWordsStarted] = useState(false);
  const wordsStartedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        timers.current.forEach(window.clearTimeout);
        timers.current = [];
        setOpeningState((current) => current === "opening" || current === "overture" ? "revealed" : current);
      }
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (openingState === "revealed" || detailsOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [openingState, detailsOpen]);

  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);

  useEffect(() => {
    if (!detailsOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setDetailsOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [detailsOpen]);

  const finishEnvelope = useCallback(() => {
    setOpeningState("overture");
    // The words begin during the last 940ms of the envelope's 9.4s motion.
    timers.current.push(window.setTimeout(() => setOpeningState("revealed"), wordsStartedRef.current ? 3_210 : 4_150));
  }, []);
  const envelopeDidLoad = useCallback(() => setEnvelopeReady(true), []);
  const envelopeUnavailable = useCallback(() => { setEnvelopeReady(false); setEnvelopeFailed(true); }, []);
  const beginWords = useCallback(() => { wordsStartedRef.current = true; setWordsStarted(true); }, []);

  useEffect(() => {
    if (openingState !== "opening" || !envelopeFailed) return;
    const timer = window.setTimeout(finishEnvelope, 2_800);
    return () => window.clearTimeout(timer);
  }, [openingState, envelopeFailed, finishEnvelope]);

  const open = useCallback(() => {
    if (openingState !== "sealed") return;
    if (musicPreferred && audioRef.current) {
      audioRef.current.volume = .36;
      void audioRef.current.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    }
    if (reducedMotion) { setOpeningState("revealed"); return; }
    setOpeningState("opening");
  }, [openingState, musicPreferred, reducedMotion]);

  const skipOpening = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setOpeningState("revealed");
  }, []);

  const goTo = useCallback((id: string) => {
    if (openingState !== "revealed") skipOpening();
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }), 20);
  }, [openingState, reducedMotion, skipOpening]);

  const replay = () => {
    window.scrollTo({ top: 0, behavior: "auto" });
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setMusicOn(false);
    setEnvelopeReady(false);
    setEnvelopeFailed(false);
    wordsStartedRef.current = false;
    setWordsStarted(false);
    setOpeningState("sealed");
  };

  const toggleMusic = useCallback(async () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      try { await audioRef.current.play(); setMusicOn(true); } catch { setMusicOn(false); }
    } else { audioRef.current.pause(); setMusicOn(false); }
  }, []);

  const scenes = Object.fromEntries(fixture.scenes.map((scene) => [scene.id, scene])) as Record<Chapter["id"], Chapter>;
  const entourage = fixture.entourage.filter((group) => !group.optional || group.members.length > 0);

  return <main className={styles.showcase}>
    <audio ref={audioRef} src="/wedding-showcase/there-is-romance.mp3" loop preload="none" />
    {openingState === "revealed" && <nav className={styles.nav} aria-label="Invitation controls">
      <button className={styles.brand} onClick={() => goTo("reveal")} aria-label="Return to the invitation">L <span>&amp;</span> C</button>
      <div className={styles.navActions}>
        <button onClick={replay} aria-label="Replay envelope opening" title="Replay"><RotateCcw size={17} /></button>
        <button onClick={() => void toggleMusic()} aria-label={musicOn ? "Mute music" : "Play music"}>{musicOn ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
        <button onClick={() => setDetailsOpen(true)} aria-label="Wedding details"><Menu size={17} /><span>Details</span></button>
        <button onClick={() => goTo("rsvp")}>RSVP</button>
      </div>
    </nav>}

    {openingState !== "revealed" && <section className={`${styles.opening} ${openingState === "opening" ? styles.openingActive : ""} ${openingState === "overture" ? styles.overture : ""} ${envelopeFailed ? styles.openingFallback : ""}`} aria-label={openingState === "overture" ? "Introducing the wedding" : "A blue envelope with a seashell seal"}>
      {openingState !== "overture" && <div className={styles.openingTop}>
        <span className={styles.smallCaps}>Maison de Moments</span>
        <span className={styles.openingNumber}>No. 02 / Wedding collection</span>
      </div>}
      <div className={styles.staticEnvelope} style={{ visibility: envelopeReady || openingState === "overture" ? "hidden" : "visible" }} aria-hidden="true"><div className={styles.seal} /></div>
      {!reducedMotion && !envelopeFailed && <div className={styles.envelopeCanvas} style={{ visibility: envelopeReady ? "visible" : "hidden" }} aria-hidden="true"><BeachEnvelope opening={openingState === "opening"} onReady={envelopeDidLoad} onWordsStart={beginWords} onComplete={finishEnvelope} onUnavailable={envelopeUnavailable} /></div>}
      {openingState === "sealed" && <button className={styles.sealTarget} onClick={open} aria-label="Open the blue wedding envelope" />}
      {(openingState === "opening" || openingState === "overture") && <button className={styles.skipOpening} onClick={skipOpening}>Skip to invitation</button>}
      {openingState !== "overture" && <div className={styles.openingBottom}>
        <p className={styles.scriptLine}>An invitation carried by the tide</p>
        <p className={styles.smallCaps}>{openingState === "opening" ? "Opening your invitation" : "Tap the seashell to open"}</p>
      </div>}
      {openingState === "sealed" && <button className={styles.musicPreference} onClick={() => setMusicPreferred((current) => !current)} aria-pressed={musicPreferred}><Music2 size={16} />Music {musicPreferred ? "on" : "off"}</button>}
      {(wordsStarted || openingState === "overture") && <div className={styles.overtureCopy}><p className={styles.overtureLine}>The tide brought us here</p><p className={styles.overtureLine}>to a lifetime together</p></div>}
    </section>}

    {openingState === "revealed" && <>
      <section id="reveal" className={styles.hero} aria-labelledby="beach-title">
        <div className={styles.heroArt} aria-hidden="true" />
        <PaintedSurfFrames reducedMotion={reducedMotion} />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>{scenes.invitation.eyebrow}</p>
          <p className={styles.heroPrelude}>A sea of love</p>
          <h1 id="beach-title">{fixture.couple.first}<span>&amp;</span>{fixture.couple.second}</h1>
          <div className={styles.heroDate}><span />{fixture.dateLabel}<span /></div>
          <p className={styles.heroInvitation}>{scenes.invitation.title}. {scenes.invitation.copy}</p>
          <button className={styles.heroScroll} onClick={() => goTo("story")}>Our story <ArrowDown size={16} /></button>
        </div>
        <p className={styles.heroFootnote}>Boracay, painted in the colors of the sea</p>
      </section>

      <section id="story" className={styles.story} aria-labelledby="story-title">
        <div className={styles.sectionIntro}>
          <span className={styles.shellMotif} aria-hidden="true" />
          <p className={styles.eyebrow}>The way to forever</p>
          <h2 id="story-title">Every tide has a story</h2>
          <p>From the first page to the promise of a lifetime.</p>
        </div>
        <div className={styles.storyLayout}>
          <figure className={styles.storyArtwork}><Image src="/beach-wedding/palm-walkway.webp" alt="Watercolor path through palms and flowers toward the Boracay sea" fill sizes="(max-width: 800px) 90vw, 44vw" /><figcaption>Where every path led us</figcaption></figure>
          <div className={styles.storyChapters}>
            {[scenes.bookshop, scenes.proposal, scenes.venue].map((scene, index) => <article className={styles.chapter} key={scene.id}>
              <div className={styles.chapterNumber}>{String(index + 1).padStart(2, "0")}</div>
              <div><p className={styles.eyebrow}>{scene.eyebrow}</p><h3>{scene.title}</h3><p>{scene.copy}</p></div>
            </article>)}
          </div>
        </div>
      </section>

      <section id="celebration" className={styles.celebration} aria-labelledby="celebration-title">
        <div className={styles.celebrationHead}>
          <p className={styles.eyebrow}>{scenes.celebration.eyebrow}</p>
          <h2 id="celebration-title">{scenes.celebration.title}</h2>
          <p>{scenes.celebration.copy}</p>
          <div className={styles.dateStamp}><small>Monday</small><strong>14</strong><small>June 2027</small></div>
        </div>
        <figure className={styles.dinnerArtwork}><Image src="/beach-wedding/shoreline-dinner.webp" alt="Watercolor seaside wedding dinner with flowers and lanterns at sunset" fill sizes="(max-width: 700px) 100vw, 950px" /><figcaption>Meet us where the light meets the water</figcaption></figure>
        <div className={styles.eventCards}>
          <article><span>01 / The ceremony</span><h3>{fixture.ceremony.time}</h3><strong>{fixture.ceremony.venue}</strong><p>{fixture.ceremony.address}</p></article>
          <article><span>02 / The reception</span><h3>{fixture.reception.time}</h3><strong>{fixture.reception.venue}</strong><p>{fixture.reception.address}</p></article>
          <article><span>03 / Dress code</span><h3>Beach formal</h3><p>A touch of romance in olive, rose, terracotta, or champagne.</p><div className={styles.swatches} aria-label={fixture.palette.map((color) => color.name).join(", ")}>{fixture.palette.map((color) => <i key={color.name} style={{ backgroundColor: color.color }} title={color.name} />)}</div></article>
        </div>
      </section>

      <section id="entourage" className={styles.entourage} aria-labelledby="entourage-title">
        <div className={styles.entouragePaper}>
          <div className={styles.entourageOrnament} aria-hidden="true" />
          <div className={styles.sectionIntro}><p className={styles.eyebrow}>{scenes.entourage.eyebrow}</p><h2 id="entourage-title">{scenes.entourage.title}</h2><p>{scenes.entourage.copy}</p></div>
          <div className={styles.entourageGrid}>{entourage.map((group) => <article key={group.id}><h3>{group.title}</h3><ul>{group.members.map((member) => <li key={member}>{member}</li>)}</ul></article>)}</div>
          <p className={styles.note}>{fixture.entourageNote}</p>
        </div>
      </section>

      <section id="program" className={styles.program} aria-labelledby="program-title">
        <div className={styles.programLayout}>
          <div className={styles.programScenery} aria-hidden="true"><span>From the first hello<br />to the last dance</span></div>
          <div className={styles.programContent}>
            <div className={styles.sectionIntro}><p className={styles.eyebrow}>{scenes.program.eyebrow}</p><h2 id="program-title">{scenes.program.title}</h2><p>{scenes.program.copy}</p></div>
            <ol>{fixture.program.map((item, index) => <li key={`${item.time}-${item.title}`}><span className={styles.programNumber}>{String(index + 1).padStart(2, "0")}</span><time>{item.time}</time><div><h3>{item.title}</h3>{item.detail && <p>{item.detail}</p>}</div></li>)}</ol>
            <p className={styles.note}>{fixture.programNote}</p>
          </div>
        </div>
      </section>

      <section id="rsvp" className={styles.rsvp} aria-labelledby="rsvp-title">
        <div className={styles.rsvpCard}>
          <span className={styles.rsvpSun} aria-hidden="true" />
          <p className={styles.eyebrow}>{scenes.rsvp.eyebrow} by {fixture.rsvpDeadline}</p>
          <h2 id="rsvp-title">{reply ? "Your demo reply is ready" : scenes.rsvp.title}</h2>
          {!reply ? <><p>{scenes.rsvp.copy}</p><div className={styles.rsvpActions}><button onClick={() => setReply("yes")}>Joyfully accepts</button><button onClick={() => setReply("no")}>Regretfully declines</button></div></> : <div className={styles.reply} role="status"><Check /><p>{reply === "yes" ? "We’ll save you a place beneath the Boracay stars." : "Your thoughtful reply would be shared with the couple."}</p><small>Demo only. Nothing was submitted.</small><button onClick={() => setReply(null)}>Change demo reply</button></div>}
        </div>
      </section>
      <footer className={styles.footer}><p>Same people. A brighter tomorrow.</p><span>{fixture.couple.monogram}</span><small>Maison de Moments · Tropical wedding study<br /><a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100044" target="_blank" rel="noreferrer">“There Is Romance”</a> by Kevin MacLeod, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</small></footer>
    </>}

    {detailsOpen && <div className={styles.dialogBackdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) setDetailsOpen(false); }}><aside className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="beach-details-title"><button className={styles.close} onClick={() => setDetailsOpen(false)} aria-label="Close details"><X /></button><p className={styles.eyebrow}>At a glance</p><h2 id="beach-details-title">Wedding details</h2><dl><div><dt>Date</dt><dd>{fixture.dateLabel}</dd></div><div><dt>Ceremony</dt><dd>{fixture.ceremony.time}<br />{fixture.ceremony.venue}<br />{fixture.ceremony.address}</dd></div><div><dt>Reception</dt><dd>{fixture.reception.time}<br />{fixture.reception.venue}<br />{fixture.reception.address}</dd></div><div><dt>Dress code</dt><dd>Beach formal</dd></div></dl><button onClick={() => { setDetailsOpen(false); goTo("entourage"); }}>Meet the entourage</button><button onClick={() => { setDetailsOpen(false); goTo("program"); }}>View the program</button><button className={styles.dialogPrimary} onClick={() => { setDetailsOpen(false); goTo("rsvp"); }}>Go to RSVP</button></aside></div>}
  </main>;
}
