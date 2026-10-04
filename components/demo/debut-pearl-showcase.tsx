"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUpRight, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getCountdownParts, type CountdownParts } from "@/lib/demo/bridgerton-countdown";
import type { CelebrationGroup, DebutFixture } from "@/lib/demo/debut-pearl";
import styles from "./debut-pearl-showcase.module.css";

type Stage = "sealed" | "opening" | "intro" | "revealed";
const OPENING_DURATION_MS = 6800;
const INTRO_DURATION_MS = 4400;
const INTRO_START_MS = OPENING_DURATION_MS - 500;

function Flourish() {
  return <svg className={styles.flourish} viewBox="0 0 200 30" fill="none" aria-hidden="true"><path d="M5 15h65c18 0 20-12 30-12 10 0 12 12 30 12h65M70 15c18 0 20 12 30 12 10 0 12-12 30-12M96 15l4-4 4 4-4 4z" stroke="currentColor" /></svg>;
}

function TributeArt({ kind }: { kind: CelebrationGroup["id"] }) {
  return <Image className={styles.tributeArt} src={`/debut-pearl/watercolor-${kind}-v2.webp`} alt="" width={180} height={180} />;
}

function Countdown({ fixture }: { fixture: DebutFixture }) {
  const [parts, setParts] = useState<CountdownParts | null>(null);
  useEffect(() => {
    const update = () => setParts(getCountdownParts(fixture.startsAt, Date.now()));
    update();
    const timer = window.setInterval(() => { if (!document.hidden) update(); }, 1000);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [fixture.startsAt]);
  return <div className={styles.countdown} aria-label="Time until the debut">{parts?.complete ? <p>The celebration has begun.</p> : (["days", "hours", "minutes", "seconds"] as const).map((unit) => <div key={unit}><strong>{parts ? String(parts[unit]).padStart(2, "0") : "··"}</strong><span>{unit}</span></div>)}</div>;
}

export function DebutPearlShowcase({ fixture }: { fixture: DebutFixture }) {
  const [stage, setStage] = useState<Stage>("sealed");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const [reply, setReply] = useState<"yes" | "no" | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [musicPreferred, setMusicPreferred] = useState(true);
  const [musicUnavailable, setMusicUnavailable] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timers = useRef<number[]>([]);
  const opening = useRef(false);
  const focusOpening = useRef(false);
  const heroRef = useRef<HTMLHeadingElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const revealed = stage === "revealed";
  const firstName = fixture.celebrant.split(" ")[0];
  const groups = fixture.groups.filter((group) => group.members.length > 0);
  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);
  const reveal = useCallback(() => { clearTimers(); setStage("revealed"); opening.current = false; }, [clearTimers]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => { audio?.pause(); };
  }, []);
  const playMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.28;
    setMusicUnavailable(false);
    void audio.play().catch(() => setMusicOn(false));
  };
  const toggleMusic = () => {
    if (musicOn) {
      setMusicPreferred(false);
      audioRef.current?.pause();
    } else {
      setMusicPreferred(true);
      playMusic();
    }
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(media.matches); if (media.matches && opening.current) reveal(); };
    update(); media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); clearTimers(); };
  }, [clearTimers, reveal]);
  useEffect(() => {
    const portrait = window.matchMedia("(max-aspect-ratio: 1/1)");
    const assets: HTMLImageElement[] = [];
    const load = (src: string) => {
      const art = new window.Image();
      art.onerror = () => { setArtFailed(true); if (opening.current) reveal(); };
      art.src = src;
      assets.push(art);
    };
    const loadEnvelope = () => load(`/debut-pearl/envelope-${portrait.matches ? "mobile" : "desktop"}-v2.webp`);
    loadEnvelope(); load("/debut-pearl/pearl-seal-v2.webp");
    portrait.addEventListener("change", loadEnvelope);
    return () => { portrait.removeEventListener("change", loadEnvelope); assets.forEach((art) => { art.onerror = null; }); };
  }, [reveal]);
  useEffect(() => {
    if (revealed) { heroRef.current?.focus({ preventScroll: true }); return; }
    if (stage === "sealed" && focusOpening.current) { openRef.current?.focus({ preventScroll: true }); focusOpening.current = false; }
  }, [revealed, stage]);

  useEffect(() => {
    if (revealed) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [revealed]);

  const open = () => {
    if (opening.current || stage !== "sealed") return;
    if (musicPreferred) playMusic();
    if (reducedMotion || artFailed) { reveal(); return; }
    opening.current = true;
    setStage("opening");
    timers.current.push(window.setTimeout(() => setStage("intro"), INTRO_START_MS));
    // Intro: 600ms in, 3200ms readable hold, 600ms out.
    timers.current.push(window.setTimeout(reveal, INTRO_START_MS + INTRO_DURATION_MS));
  };
  const replay = () => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    clearTimers(); opening.current = false; focusOpening.current = true; setReply(null); setDetailsOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" }); setStage("sealed");
  };
  const goTo = (id: string) => {
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
    target?.focus({ preventScroll: true });
  };

  return <main className={styles.showcase} data-stage={stage} data-art-failed={artFailed} style={{ "--opening-duration": `${OPENING_DURATION_MS}ms`, "--intro-duration": `${INTRO_DURATION_MS}ms` } as CSSProperties}>
    <audio ref={audioRef} src="/wedding-showcase/there-is-romance.mp3" loop preload="none" onPlaying={() => { setMusicOn(true); setMusicUnavailable(false); }} onPause={() => setMusicOn(false)} onError={() => { setMusicOn(false); setMusicUnavailable(true); }} />
    {stage !== "sealed" && <button className={styles.musicControl} onClick={toggleMusic} aria-label={musicOn ? "Mute music" : musicUnavailable ? "Retry music" : "Play music"} aria-pressed={musicOn}>{musicOn ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}<span>{musicOn ? "Music on" : musicUnavailable ? "Retry music" : "Music off"}</span></button>}
    <div className={styles.atelier}>Maison de Moments <span>Invitation atelier</span></div>
    {revealed && <nav className={styles.nav} aria-label="Invitation controls">
      <button onClick={() => goTo("invitation")} className={styles.navMonogram} aria-label="Return to invitation">{fixture.monogram}</button>
      <div><Dialog open={detailsOpen} onOpenChange={setDetailsOpen}><DialogTrigger asChild><button>Details</button></DialogTrigger><DialogContent className={styles.dialog}><DialogTitle>Celebration details</DialogTitle><DialogDescription>A fictional eighteenth birthday invitation.</DialogDescription><p>{fixture.dateLabel}<br />{fixture.timeLabel} · Manila time</p><p>{fixture.venue}<br />{fixture.address}</p><p>Formal attire in dusty rose, champagne, or muted olive. Please reserve ivory for the debutante.</p><p>Kindly reply by {fixture.rsvpDeadline}.</p><button className={styles.button} onClick={() => { setDetailsOpen(false); window.requestAnimationFrame(() => goTo("rsvp")); }}>Go to RSVP</button></DialogContent></Dialog>
      <button onClick={() => goTo("circle")}>Celebration circle</button><button onClick={() => goTo("rsvp")}>RSVP</button><button onClick={replay} aria-label="Replay envelope opening"><RotateCcw size={16} /></button></div>
    </nav>}
    <section className={styles.hero} aria-label={revealed ? "Your invitation" : "A pearl-sealed invitation"}>
      <div className={styles.paper}>
        <div className={styles.paperBorder} aria-hidden="true" />
        <div className={styles.floralsTop} aria-hidden="true" /><div className={styles.floralsBottom} aria-hidden="true" />
        {!revealed ? <div className={styles.opening}>
          <p className={styles.kicker}>Maison de Moments <span>Pearl &amp; Poise · The debut collection</span></p>
          <div className={styles.envelopeFrame} data-testid="pearl-envelope-frame">
          <div className={styles.envelope} aria-hidden="true">
            <div className={styles.pocket} />
            <div className={styles.flap} data-testid="pearl-flap"><div className={styles.flapFront} /><div className={styles.flapBack} /><span className={styles.seal} /></div>
          </div>
          {stage === "sealed" && <button ref={openRef} className={styles.openButton} onClick={open} aria-label="Open the pearl-sealed debut invitation"><span className={styles.sealHit} aria-hidden="true" /></button>}
          </div>
          <p className={styles.openingNote}><em>A beautiful chapter awaits.</em><span>Tap the pearl seal to open · {musicPreferred ? "with music" : "sound off"}</span></p>
        </div> : null}
        {stage === "intro" && <div className={styles.intro}><Flourish /><p>Eighteen years<br />of becoming.</p><span>A beautiful chapter begins.</span><Flourish /></div>}
        {revealed && <div className={styles.heroCopy}>
          <div className={styles.monogram} aria-hidden="true">{fixture.monogram}</div>
          <p className={styles.kicker}>{fixture.hostWording}</p>
          <h1 ref={heroRef} tabIndex={-1} id="invitation">{fixture.celebrant}</h1>
          <p className={styles.invites}>joyfully invites you to celebrate her</p>
          <p className={styles.eighteen}>Eighteenth</p><p className={styles.kicker}>Birthday celebration</p>
          <Flourish /><p className={styles.heroDate}>{fixture.dateLabel}</p><p>{fixture.timeLabel}</p>
          <p className={styles.heroVenue}>{fixture.venue}<span>{fixture.address}</span></p>
          <button className={styles.continue} onClick={() => goTo("chapter")}>The evening awaits <ArrowDown size={16} /></button>
        </div>}
      </div>
      {(stage === "opening" || stage === "intro") && <button className={styles.skip} onClick={reveal}>Skip to invitation <ArrowUpRight size={14} /></button>}
      {!revealed && <p className={styles.sampleLabel}>Pearl &amp; Poise · A fictional debut invitation</p>}
    </section>
    {revealed && <>
      <section className={styles.letter} id="chapter" tabIndex={-1}><p className={styles.kicker}>A note from {firstName}</p><h2>A new chapter,<br /><em>with you beside me.</em></h2><p>{fixture.message}</p><span className={styles.signature}>With love, {firstName}</span><Flourish /></section>
      <section className={styles.detailsSection} aria-labelledby="details-title"><div className={styles.detailsCard}><p className={styles.kicker}>Save a little space for wonder</p><h2 id="details-title">The celebration</h2><p className={styles.venue}>{fixture.venue}</p><p>{fixture.address}</p><Flourish /><p>{fixture.dateLabel}<br />{fixture.timeLabel} · Manila time</p><Countdown fixture={fixture} /></div><div className={styles.attire}><p className={styles.kicker}>Dressed for a beautiful evening</p><h2>A touch of elegance</h2><p>Formal attire in soft, romantic hues.<br />Come in something that feels like you.</p><div className={styles.swatches}>{[["Dusty rose", "#bc8985"], ["Champagne", "#dac4a0"], ["Muted olive", "#989a80"]].map(([name, color]) => <div key={name}><span style={{ backgroundColor: color }} /><p>{name}</p></div>)}</div><p className={styles.small}>Kindly reserve ivory for the debutante.</p></div></section>
      <section className={styles.program} aria-labelledby="program-title"><div><p className={styles.kicker}>The order of our evening</p><h2 id="program-title">Moments<br /><em>to remember.</em></h2><TributeArt kind="candles" /><p>Good company, a few happy tears,<br />and a dance floor waiting for us.</p></div><ol>{fixture.program.map((moment) => <li key={moment.title}><span>{moment.time}</span><div><h3>{moment.title}</h3><p>{moment.detail}</p></div></li>)}</ol></section>
      {groups.length > 0 && <section className={styles.circle} id="circle" tabIndex={-1} aria-labelledby="circle-title"><header><p className={styles.kicker}>The people who make this chapter beautiful</p><h2 id="circle-title">Her celebration circle</h2><p>Every name, a cherished part of the story.</p><p className={styles.circleHint}>Choose a group to view its names</p><nav aria-label="Celebration groups">{groups.map((group) => <a href={`#${group.id}`} key={group.id}><span>{group.title}</span><ArrowDown size={14} aria-hidden="true" /></a>)}</nav></header>{groups.map((group, index) => <article className={styles.group} id={group.id} tabIndex={-1} key={group.id} aria-labelledby={`${group.id}-title`}><span className={styles.chapterNumber}>0{index + 1} / WITH LOVE</span><TributeArt kind={group.id} /><h3 id={`${group.id}-title`}>{group.title}</h3><p>{group.introduction}</p><ol>{group.members.map((person) => <li key={person.id}>{person.name}</li>)}</ol><Flourish /></article>)}</section>}
      <section className={styles.rsvp} id="rsvp" tabIndex={-1} aria-labelledby="rsvp-title"><div className={styles.rsvpCard}><p className={styles.kicker}>Your company would mean the world</p><h2 id="rsvp-title">Kindly reply</h2><p>Please let us know by {fixture.rsvpDeadline}.</p><p className={styles.small}>This is a fictional sample. Try a response below.<br />No guest information is collected or submitted.</p><div className={styles.replyActions}><button className={styles.button} aria-pressed={reply === "yes"} onClick={() => setReply("yes")}>Joyfully accepts</button><button className={styles.button} aria-pressed={reply === "no"} onClick={() => setReply("no")}>Regretfully declines</button></div><div className={styles.replyStatus} role="status">{reply && `Sample response: ${reply === "yes" ? "joyfully accepts" : "regretfully declines"}. Nothing was submitted.`}</div><Flourish /><p className={styles.small}>Your presence is the loveliest gift.</p></div></section>
      <footer className={styles.footer}><div className={styles.monogram}>{fixture.monogram}</div><p>For all that has been.<br /><em>For all that is to come.</em></p><span>Pearl &amp; Poise · Maison de Moments</span><small>Fictional celebrant, participants, venue, and event.</small><p className={styles.musicCredit}>Music: <a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100044" target="_blank" rel="noreferrer">“There is Romance”</a> by Kevin MacLeod · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p><Link href="/designs/pearl-and-poise">Discover this design <ArrowUpRight size={14} /></Link></footer>
    </>}
  </main>;
}
