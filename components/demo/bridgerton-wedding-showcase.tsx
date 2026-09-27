"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, BookOpen, CakeSlice, Check, Church, GlassWater, Heart, Landmark, Menu, Music2, RotateCcw, UtensilsCrossed, Users, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { WeddingShowcaseFixture } from "@/lib/demo/wedding-showcase";
import { getCountdownParts, type CountdownParts } from "@/lib/demo/bridgerton-countdown";
import styles from "./bridgerton-wedding-showcase.module.css";

type OpeningState = "sealed" | "opening" | "intro" | "revealed";
type Scene = WeddingShowcaseFixture["scenes"][number];

const programIcons = [Users, Church, GlassWater, Heart, UtensilsCrossed, Music2, CakeSlice, Music2];
const storyIcons = [BookOpen, Heart, Landmark];

function Flourish() {
  return <svg className={styles.flourish} viewBox="0 0 240 32" fill="none" aria-hidden="true"><path d="M8 16h68c18 0 25-13 36-13-7 3-8 10 8 13-16 3-15 10-8 13-11 0-18-13-36-13M232 16h-68c-18 0-25-13-36-13 7 3 8 10-8 13 16 3 15 10 8 13 11 0 18-13 36-13" stroke="currentColor" /><path d="m120 10 6 6-6 6-6-6z" fill="currentColor" /></svg>;
}

function Countdown({ target }: { target: string }) {
  const [parts, setParts] = useState<CountdownParts | null>(null);
  useEffect(() => {
    const update = () => setParts(getCountdownParts(target, Date.now()));
    update();
    const interval = window.setInterval(() => { if (!document.hidden) update(); }, 1000);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, [target]);

  return <section className={styles.countdown} aria-labelledby="bridgerton-countdown-title">
    <Flourish />
    <p className={styles.kicker}>Until the day we say forever</p>
    <h2 id="bridgerton-countdown-title">The celebration awaits</h2>
    <p className={styles.countdownDate}>14 June 2027 · 4:00 PM · Manila</p>
    {parts?.complete ? <p className={styles.countdownDone}>The celebration has begun.</p> :
      <div className={styles.countdownGrid} aria-label="Time until the wedding">
        {(["days", "hours", "minutes", "seconds"] as const).map((key) => <div key={key}>
          <strong>{parts ? key === "days" ? parts[key] : String(parts[key]).padStart(2, "0") : "—"}</strong>
          <span>{key}</span>
        </div>)}
      </div>}
  </section>;
}

export function BridgertonWeddingShowcase({ fixture }: { fixture: WeddingShowcaseFixture }) {
  const [openingState, setOpeningState] = useState<OpeningState>("sealed");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [envelopeFailed, setEnvelopeFailed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reply, setReply] = useState<"yes" | "no" | null>(null);
  const [musicPreferred, setMusicPreferred] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const detailsButtonRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const run = useRef(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    run.current += 1;
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        clearTimers();
        setOpeningState((current) => current === "opening" || current === "intro" ? "revealed" : current);
      }
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [clearTimers]);

  useEffect(() => {
    const assets = ["/bridgerton-wedding/courtyard-desktop.webp", "/bridgerton-wedding/courtyard-mobile.webp", "/bridgerton-wedding/envelope-desktop.webp", "/bridgerton-wedding/envelope-mobile.webp", "/bridgerton-wedding/pearl-seal.webp"];
    const images = assets.map((src) => {
      const image = new window.Image();
      if (src.includes("envelope")) image.onerror = () => setEnvelopeFailed(true);
      image.src = src;
      return image;
    });
    return () => { images.forEach((image) => { image.onerror = null; }); };
  }, []);

  useEffect(() => {
    if (openingState === "revealed") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [openingState]);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const open = useCallback(() => {
    if (openingState !== "sealed") return;
    if (musicPreferred && audioRef.current) {
      audioRef.current.volume = .34;
      void audioRef.current.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false));
    }
    if (reducedMotion || envelopeFailed) { setOpeningState("revealed"); return; }
    clearTimers();
    const currentRun = run.current;
    setOpeningState("opening");
    timers.current.push(window.setTimeout(() => { if (run.current === currentRun) setOpeningState("intro"); }, 4_100));
    timers.current.push(window.setTimeout(() => { if (run.current === currentRun) setOpeningState("revealed"); }, 8_550));
  }, [openingState, musicPreferred, reducedMotion, envelopeFailed, clearTimers]);

  const skip = useCallback(() => { clearTimers(); setOpeningState("revealed"); }, [clearTimers]);
  const replay = useCallback(() => {
    clearTimers();
    window.scrollTo({ top: 0, behavior: "instant" });
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setMusicOn(false);
    setOpeningState("sealed");
  }, [clearTimers]);
  const goTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
  }, [reducedMotion]);
  const toggleMusic = useCallback(async () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      try { await audioRef.current.play(); setMusicOn(true); } catch { setMusicOn(false); }
    } else { audioRef.current.pause(); setMusicOn(false); }
  }, []);

  const revealed = openingState === "revealed";
  const moving = openingState === "opening" || openingState === "intro";
  const scenes = Object.fromEntries(fixture.scenes.map((scene) => [scene.id, scene])) as Record<Scene["id"], Scene>;
  const entourage = fixture.entourage.filter((group) => !group.optional || group.members.length > 0);

  return <main className={styles.showcase}>
    <audio ref={audioRef} src="/wedding-showcase/there-is-romance.mp3" loop preload="none" />
    {revealed && <nav className={styles.nav} aria-label="Invitation controls">
      <button className={styles.brand} onClick={() => goTo("reveal")} aria-label="Return to invitation">L <span>&amp;</span> C</button>
      <div className={styles.navActions}>
        <button onClick={replay} aria-label="Replay envelope opening" title="Replay"><RotateCcw size={17} /></button>
        <button onClick={() => void toggleMusic()} aria-label={musicOn ? "Mute music" : "Play music"} title={musicOn ? "Mute music" : "Play music"}>{musicOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <button ref={detailsButtonRef} onClick={() => setDetailsOpen(true)} aria-label="Wedding details"><Menu size={17} /><span>Details</span></button>
        <button className={styles.rsvpNav} onClick={() => goTo("rsvp")}>RSVP</button>
      </div>
    </nav>}

    <section id="reveal" className={`${styles.hero} ${moving ? styles.heroMoving : ""} ${revealed ? styles.heroRevealed : ""}`} aria-label={revealed ? "Wedding invitation" : "Sealed wedding invitation"}>
      <div className={styles.courtyard} aria-hidden="true" />
      {!revealed && <div className={`${styles.opening} ${moving ? styles.openingMoving : ""} ${envelopeFailed ? styles.openingFallback : ""}`}>
        <div className={styles.envelopePocket} aria-hidden="true" />
        <div className={styles.envelopeHinge} data-testid="bridgerton-flap" aria-hidden="true">
          <div className={styles.envelopeReverse} />
          <div className={styles.envelopeFlap} />
          <div className={styles.seal}><span>L <i>&amp;</i> C</span></div>
        </div>
        {openingState === "sealed" && <>
          <p className={styles.openingBrand}>Maison de Moments <span>· No. 03</span></p>
          <button className={styles.sealTarget} onClick={open} aria-label="Open the pearl-sealed wedding envelope" />
          <p className={styles.openingPrompt}>Tap the pearl seal to open</p>
          <button className={styles.musicPreference} onClick={() => setMusicPreferred((value) => !value)} aria-pressed={musicPreferred}><Music2 size={15} />Music {musicPreferred ? "on" : "off"}</button>
        </>}
        {moving && <button className={styles.skip} onClick={skip}>Skip to invitation</button>}
        {openingState === "intro" && <div className={styles.introWords}><p>Two stories.</p><p>One forever.</p></div>}
      </div>}
      {revealed && <div className={styles.heroContent}>
        <div className={styles.heroCrest} aria-hidden="true"><span>L &amp; C</span></div>
        <p className={styles.kicker}>{scenes.invitation.eyebrow}</p>
        <p className={styles.heroPrelude}>A Season of Forever</p>
        <h1>{fixture.couple.first}<span>&amp;</span>{fixture.couple.second}</h1>
        <Flourish />
        <p className={styles.heroDate}>{fixture.dateLabel}</p>
        <p className={styles.heroInvitation}>{scenes.invitation.title}. {scenes.invitation.copy}</p>
        <button className={styles.heroScroll} onClick={() => goTo("countdown")}>Discover our day <ArrowDown size={16} /></button>
      </div>}
      {revealed && <p className={styles.heroLocation}>Intramuros · Manila</p>}
    </section>

    {revealed && <>
      <div id="countdown"><Countdown target={fixture.dateIso} /></div>

      <section id="story" className={styles.story} aria-labelledby="story-title">
        <div className={styles.sectionHead}><p className={styles.kicker}>The chapters that brought us here</p><h2 id="story-title">A love written in its own time</h2><p>From the first page to the promise of forever.</p></div>
        <div className={styles.storySpread}>
        <figure className={styles.storyArtwork}><Image src="/bridgerton-wedding/story-keepsakes.webp" alt="An open book, a pearl ring box, sampaguita, and a blue-ribbon letter beside a capiz window" width={1500} height={844} sizes="(max-width: 700px) 100vw, 650px" /><figcaption>Every page led us to you.</figcaption></figure>
        <div className={styles.storyCards}>
          {[scenes.bookshop, scenes.proposal, scenes.venue].map((scene, index) => { const Icon = storyIcons[index]; return <article key={scene.id}>
            <span className={styles.chapterNumber}>Chapter {String(index + 1).padStart(2, "0")}</span>
            <div className={styles.storyOrnament} aria-hidden="true"><Icon size={23} strokeWidth={1.25} /></div>
            <p className={styles.kicker}>{scene.eyebrow}</p><h3>{scene.title}</h3><p>{scene.copy}</p>
          </article>; })}
        </div></div>
      </section>

      <section id="celebration" className={styles.celebration} aria-labelledby="celebration-title">
        <div className={styles.sectionHead}><p className={styles.kicker}>{scenes.celebration.eyebrow}</p><h2 id="celebration-title">{scenes.celebration.title}</h2><p>{scenes.celebration.copy}</p></div>
        <div className={styles.venueGrid}>
          <article><div className={styles.ceremonyVignette} aria-hidden="true" /><span className={styles.cardNumber}>I · The ceremony</span><h3>{fixture.ceremony.venue}</h3><Flourish /><p className={styles.venueTime}>{fixture.ceremony.time}</p><p>{fixture.ceremony.address}</p></article>
          <article><div className={styles.receptionVignette} aria-hidden="true" /><span className={styles.cardNumber}>II · The reception</span><h3>{fixture.reception.venue}</h3><Flourish /><p className={styles.venueTime}>{fixture.reception.time}</p><p>{fixture.reception.address}</p></article>
        </div>
        <p className={styles.fictionNote}>Amihan Courtyard and Hiraya Heritage Hall are fictional sample venues.</p>
      </section>

      <section id="attire" className={styles.attire} aria-labelledby="attire-title">
        <div className={styles.attireCopy}><p className={styles.kicker}>For the occasion</p><h2 id="attire-title">Filipino formal</h2><p>We would be delighted to celebrate with you in a formal barong Tagalog or a graceful Filipiniana. Choose the attire that feels right for you.</p><p>Our garden palette welcomes olive, rose, terracotta, and champagne.</p><div className={styles.swatches} aria-label={fixture.palette.map((color) => color.name).join(", ")}>{fixture.palette.map((color) => <span key={color.name} style={{ backgroundColor: color.color }} title={color.name} />)}</div></div>
        <figure className={styles.attireArtwork}><Image src="/bridgerton-wedding/filipino-formal.webp" alt="Watercolor illustration of an embroidered ivory barong Tagalog and a floor-length Filipiniana gown with butterfly sleeves" width={1100} height={1375} sizes="(max-width: 700px) 100vw, 500px" /></figure>
      </section>

      <section id="entourage" className={styles.entourage} aria-labelledby="entourage-title">
        <div className={styles.register}><div className={styles.sectionHead}><p className={styles.kicker}>{scenes.entourage.eyebrow}</p><h2 id="entourage-title">{scenes.entourage.title}</h2><p>{scenes.entourage.copy}</p></div>
          <div className={styles.parentsRegister}>{entourage.filter((group) => group.id === "parents").map((group) => <article key={group.id}><p className={styles.kicker}>With the blessing of</p><h3>{group.title}</h3><ul>{group.members.map((member) => <li key={member}>{member}</li>)}</ul></article>)}</div>
          <div className={styles.registerGrid}>{entourage.filter((group) => group.id !== "parents").map((group) => <article key={group.id}><h3>{group.title}</h3><ul>{group.members.map((member) => <li key={member}>{member}</li>)}</ul></article>)}</div>
          <p className={styles.fictionNote}>{fixture.entourageNote}</p>
        </div>
      </section>

      <section id="program" className={styles.program} aria-labelledby="program-title"><div className={styles.sectionHead}><p className={styles.kicker}>{scenes.program.eyebrow}</p><h2 id="program-title">The order of celebration</h2><p>{scenes.program.copy}</p></div>
        <ol className={styles.timeline}>{fixture.program.map((item, index) => { const Icon = programIcons[index] ?? Heart; return <li key={`${item.time}-${item.title}`}><div className={styles.timelineContent}><span className={styles.timelineTime}>{item.time}</span><h3>{item.title}</h3>{item.detail && <p>{item.detail}</p>}</div><span className={styles.timelineMark} aria-hidden="true"><Icon size={22} strokeWidth={1.5} /></span></li>; })}</ol>
        <p className={styles.fictionNote}>{fixture.programNote}</p>
      </section>

      <section id="rsvp" className={styles.rsvp} aria-labelledby="rsvp-title"><div className={styles.rsvpCard}><p className={styles.kicker}>{scenes.rsvp.eyebrow} by {fixture.rsvpDeadline}</p><div className={styles.rsvpMonogram} aria-hidden="true">L &amp; C</div><h2 id="rsvp-title">{reply ? "Your demo reply is ready" : scenes.rsvp.title}</h2>
        {!reply ? <><p>{scenes.rsvp.copy}</p><div className={styles.rsvpActions}><button onClick={() => setReply("yes")}>Joyfully accepts</button><button onClick={() => setReply("no")}>Regretfully declines</button></div></> : <div className={styles.reply} role="status"><Check size={24} /><p>{reply === "yes" ? "We would be delighted to see you in Intramuros." : "Your thoughtful reply would be shared with the couple."}</p><small>Demo only. Nothing was submitted.</small><button onClick={() => setReply(null)}>Change demo reply</button></div>}
      </div></section>
      <footer className={styles.footer}><p>A season of forever</p><span>{fixture.couple.monogram}</span><small>Maison de Moments · Filipino heritage wedding study<br /><a href="https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100044" target="_blank" rel="noreferrer">“There is Romance”</a> by Kevin MacLeod (incompetech.com), licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</small></footer>
    </>}

    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}><DialogContent className={styles.detailsDialog} onCloseAutoFocus={(event) => { event.preventDefault(); detailsButtonRef.current?.focus(); }}><p className={styles.kicker}>At a glance</p><DialogTitle className={styles.detailsTitle}>Wedding details</DialogTitle><dl>
      <div><dt>Date</dt><dd>{fixture.dateLabel}</dd></div><div><dt>Ceremony</dt><dd>{fixture.ceremony.time}<br />{fixture.ceremony.venue}<br />{fixture.ceremony.address}</dd></div><div><dt>Reception</dt><dd>{fixture.reception.time}<br />{fixture.reception.venue}<br />{fixture.reception.address}</dd></div><div><dt>Dress code</dt><dd>Filipino formal</dd></div>
    </dl><div className={styles.detailsActions}><button onClick={() => { setDetailsOpen(false); window.setTimeout(() => goTo("entourage"), 40); }}>Meet the entourage</button><button onClick={() => { setDetailsOpen(false); window.setTimeout(() => goTo("program"), 40); }}>View the program</button><button onClick={() => { setDetailsOpen(false); window.setTimeout(() => goTo("rsvp"), 40); }}>Go to RSVP</button></div></DialogContent></Dialog>
  </main>;
}
