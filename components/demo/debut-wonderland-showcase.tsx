"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { gsap } from "gsap";
import { ArrowDown, ArrowUpRight, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getCountdownParts, type CountdownParts } from "@/lib/demo/bridgerton-countdown";
import type { CelebrationGroup, DebutFixture } from "@/lib/demo/debut-pearl";
import styles from "./debut-wonderland-showcase.module.css";

type Stage = "sealed" | "preparing" | "opening" | "intro" | "revealed";
// React's server snapshot keeps the opening disabled until hydration commits.
const subscribeToClientReady = () => () => {};
const clientReadySnapshot = () => true;
const serverReadySnapshot = () => false;
const chapterNames: Record<CelebrationGroup["id"], string> = {
  roses: "The rose garden", candles: "A little light", treasures: "Curious little treasures", "blue-bills": "The next adventure",
};

function Ornament() {
  return <svg className={styles.ornament} viewBox="0 0 180 24" fill="none" aria-hidden="true"><path d="M0 12h60c16 0 18-9 30-9s14 9 30 9h60M60 12c16 0 18 9 30 9s14-9 30-9M86 12l4-4 4 4-4 4Z" stroke="currentColor" /></svg>;
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

function ChapterArt({ kind, className }: { kind: CelebrationGroup["id"]; className?: string }) {
  return <Image className={className ?? styles.chapterArt} src={`/debut-wonderland/watercolor-${kind}-v1.webp`} alt="" width={700} height={700} />;
}

export function DebutWonderlandShowcase({ fixture }: { fixture: DebutFixture }) {
  const [stage, setStage] = useState<Stage>("sealed");
  const clientReady = useSyncExternalStore(subscribeToClientReady, clientReadySnapshot, serverReadySnapshot);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reply, setReply] = useState<"yes" | "no" | null>(null);
  const [smiling, setSmiling] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [musicUnavailable, setMusicUnavailable] = useState(false);
  const stageRef = useRef<Stage>("sealed");
  const motionRef = useRef(false);
  const musicPreferred = useRef(true);
  const run = useRef(0);
  const assetPreparation = useRef<Promise<boolean>>(Promise.resolve(false));
  const assetFailure = useRef(false);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const openingRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLDivElement>(null);
  const keyTurnRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const backArchRef = useRef<HTMLDivElement>(null);
  const frontArchRef = useRef<HTMLDivElement>(null);
  const foregroundRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const dialogDestination = useRef<string | null>(null);
  const refocusOpening = useRef(false);
  const revealed = stage === "revealed";
  const groups = fixture.groups.filter((group) => group.members.length > 0);

  const changeStage = useCallback((next: Stage) => { stageRef.current = next; setStage(next); }, []);
  const cancelOpening = useCallback(() => {
    run.current += 1;
    timeline.current?.kill();
    timeline.current = null;
  }, []);
  const reveal = useCallback(() => {
    cancelOpening();
    // Finish on the same mounted scene and its final camera position, including skip.
    if (sceneRef.current) gsap.set(sceneRef.current, { scale: 1.025 });
    if (foregroundRef.current) gsap.set(foregroundRef.current, { opacity: 1, rotationX: 0 });
    changeStage("revealed");
  }, [cancelOpening, changeStage]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      motionRef.current = media.matches;
      setReducedMotion(media.matches);
      if (media.matches && ["preparing", "opening", "intro"].includes(stageRef.current)) reveal();
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [reveal]);

  useEffect(() => {
    const portrait = window.matchMedia("(max-aspect-ratio: 1/1)");
    let active = true;
    const prepare = () => {
      const orientation = portrait.matches ? "mobile" : "desktop";
      const sources = ["bookcloth-v1.webp", "golden-key-v1.webp", "brass-keyhole-v2.webp", "watercolor-roses-v1.webp", "watercolor-blue-bills-v1.webp", `garden-${orientation}-v1.webp`, `paper-arch-${orientation}-v1.webp`];
      assetPreparation.current = Promise.all(sources.map(async (source) => {
        const art = new window.Image();
        art.src = `/debut-wonderland/${source}`;
        await art.decode();
      })).then(() => !assetFailure.current).catch(() => {
        if (active) {
          assetFailure.current = true;
          setArtFailed(true);
          if (["preparing", "opening", "intro"].includes(stageRef.current)) reveal();
        }
        return false;
      });
    };
    prepare();
    portrait.addEventListener("change", prepare);
    return () => { active = false; portrait.removeEventListener("change", prepare); };
  }, [reveal]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => { cancelOpening(); audio?.pause(); };
  }, [cancelOpening]);
  useEffect(() => {
    if (revealed) heroRef.current?.focus({ preventScroll: true });
    else if (stage === "sealed" && refocusOpening.current) { openRef.current?.focus({ preventScroll: true }); refocusOpening.current = false; }
  }, [revealed, stage]);
  useEffect(() => {
    if (revealed) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [revealed]);
  useEffect(() => {
    if (!smiling) return;
    const timer = window.setTimeout(() => setSmiling(false), 2800);
    return () => window.clearTimeout(timer);
  }, [smiling]);

  const playMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = .28;
    setMusicUnavailable(false);
    void audio.play().catch(() => setMusicOn(false));
  };
  const toggleMusic = () => {
    musicPreferred.current = !musicOn;
    if (musicOn) audioRef.current?.pause(); else playMusic();
  };
  const open = async () => {
    if (stageRef.current !== "sealed") return;
    changeStage("preparing");
    const currentRun = ++run.current;
    // Start audio synchronously within the guest gesture, before decoding awaits.
    if (musicPreferred.current) playMusic();
    if (motionRef.current || assetFailure.current) { reveal(); return; }
    const ready = await assetPreparation.current;
    if (run.current !== currentRun) return;
    if (!ready || motionRef.current) { reveal(); return; }
    changeStage("opening");
    const portalWidth = parseFloat(getComputedStyle(coverRef.current!).getPropertyValue("--portal-width")) || 170;
    const portalScale = Math.max(28, Math.max(window.innerWidth, window.innerHeight) / portalWidth * 7);
    const sequence = gsap.timeline();
    timeline.current = sequence;
    sequence
      .to(openingRef.current!.querySelectorAll("[data-opening-copy]"), { opacity: 0, duration: .6 }, 0)
      // The tip seats in the lock; the key turns around its shaft, then withdraws.
      .to(keyRef.current, { x: 0, y: 0, rotation: 0, rotationY: -58, duration: .65, ease: "power2.inOut" }, 0)
      .to(keyRef.current, { filter: "drop-shadow(1px 2px 1px #4f422b66)", duration: .65 }, 0)
      .to(keyTurnRef.current, { rotationX: 85, duration: .8, ease: "power2.inOut" }, .65)
      .to(keyRef.current, { x: 24, y: 16, rotationY: -20, opacity: 0, duration: .5, ease: "power2.in" }, 1.45)
      .to(coverRef.current!.querySelector("[data-keyhole-peek]"), { opacity: 0, duration: .8 }, 1.85)
      .to(coverRef.current!.querySelector("[data-keyhole-rim]"), { opacity: 0, duration: .8 }, 2.4)
      .to(coverRef.current, { "--portal-scale": portalScale, duration: 2.95, ease: "power2.inOut" }, 1.85)
      .to(sceneRef.current, { scale: 1.025, duration: 5.2, ease: "sine.inOut" }, 1.2)
      .fromTo(backArchRef.current, { opacity: 0, scale: .9 }, { opacity: 1, scale: 1.08, duration: .7, ease: "sine.out" }, 1.9)
      .to(backArchRef.current, { scale: 1.7, duration: 2.3, ease: "sine.in" }, 2.6)
      .to(backArchRef.current, { opacity: 0, duration: .65 }, 4.2)
      .fromTo(frontArchRef.current, { opacity: 0, scale: 1 }, { opacity: 1, scale: 1.16, duration: .7 }, 2.3)
      .to(frontArchRef.current, { scale: 2.3, duration: 2.1, ease: "sine.in" }, 3)
      .to(frontArchRef.current, { opacity: 0, duration: .65 }, 4.5)
      .to(coverRef.current, { opacity: 0, duration: .5 }, 4.4)
      .fromTo(foregroundRef.current, { opacity: 0, rotationX: 75 }, { opacity: 1, rotationX: 0, duration: 1.4, ease: "sine.out", transformOrigin: "center bottom" }, 4.8)
      .call(() => changeStage("intro"), [], 6.4)
      .to(introRef.current, { opacity: 1, duration: .6 }, 6.4)
      .to(introRef.current, { opacity: 0, duration: .6 }, 10.2)
      .call(reveal, [], 10.8);
  };
  const replay = () => {
    cancelOpening();
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setReply(null); setSmiling(false); setDetailsOpen(false);
    gsap.set(coverRef.current, { "--portal-scale": 1, opacity: 1 });
    gsap.set(coverRef.current!.querySelector("[data-keyhole-peek]"), { opacity: 1 });
    gsap.set(coverRef.current!.querySelector("[data-keyhole-rim]"), { opacity: 1 });
    gsap.set(keyRef.current, { clearProps: "transform,filter", opacity: 1 });
    gsap.set(keyTurnRef.current, { clearProps: "transform" });
    gsap.set(sceneRef.current, { scale: 1 });
    gsap.set([introRef.current, backArchRef.current, frontArchRef.current, foregroundRef.current], { opacity: 0 });
    gsap.set(openingRef.current!.querySelectorAll("[data-opening-copy]"), { opacity: 1 });
    refocusOpening.current = true;
    window.scrollTo({ top: 0, behavior: "instant" });
    changeStage("sealed");
  };
  const goTo = (id: string) => {
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: motionRef.current ? "instant" : "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  };
  const showDetails = (button: HTMLButtonElement) => {
    // Stop a garden-path scroll before the dialog locks the page and takes focus.
    window.scrollTo({ top: window.scrollY, behavior: "instant" });
    detailTrigger.current = button;
    setDetailsOpen(true);
  };

  return <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
    <main className={styles.showcase} data-stage={stage} data-art-failed={artFailed} data-reduced-motion={reducedMotion}>
      <audio ref={audioRef} src="/wedding-showcase/there-is-romance.mp3" loop preload="none" onPlaying={() => { if (stageRef.current === "sealed") { audioRef.current?.pause(); return; } setMusicOn(true); setMusicUnavailable(false); }} onPause={() => setMusicOn(false)} onError={() => { setMusicOn(false); setMusicUnavailable(true); }} />
      {stage !== "sealed" && <button className={styles.musicControl} onClick={toggleMusic} aria-label={musicOn ? "Mute music" : musicUnavailable ? "Retry music" : "Play music"} aria-pressed={musicOn}>{musicOn ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}<span>{musicOn ? "Music on" : musicUnavailable ? "Retry music" : "Music off"}</span></button>}
      {revealed && <nav className={styles.nav} aria-label="Invitation controls"><button className={styles.navMonogram} onClick={() => goTo("invitation")} aria-label="Return to invitation">{fixture.monogram}</button><div><button onClick={(event) => showDetails(event.currentTarget)} aria-haspopup="dialog">Details</button><button onClick={() => goTo("circle")}>Her circle</button><button onClick={() => goTo("rsvp")}>RSVP</button><button onClick={replay} aria-label="Replay Wonderland opening"><RotateCcw size={16} aria-hidden="true" /></button></div></nav>}

      <section className={styles.hero} aria-label={revealed ? "Your Wonderland invitation" : "A key to Wonderland"}>
        <div ref={sceneRef} className={styles.gardenScene} data-testid="wonderland-garden" aria-hidden="true"><picture><source media="(max-aspect-ratio: 1/1)" srcSet="/debut-wonderland/garden-mobile-v1.webp" /><img src="/debut-wonderland/garden-desktop-v1.webp" alt="" width={1536} height={1024} fetchPriority="high" /></picture></div>
        <div ref={openingRef} className={styles.opening} aria-hidden={revealed ? true : undefined}>
          <div ref={backArchRef} className={`${styles.tunnelArch} ${styles.backArch}`} aria-hidden="true"><picture><source media="(max-aspect-ratio: 1/1)" srcSet="/debut-wonderland/paper-arch-mobile-v1.webp" /><img src="/debut-wonderland/paper-arch-desktop-v1.webp" width={1536} height={1024} alt="" /></picture></div>
          <div ref={frontArchRef} className={styles.tunnelArch} aria-hidden="true"><picture><source media="(max-aspect-ratio: 1/1)" srcSet="/debut-wonderland/paper-arch-mobile-v1.webp" /><img src="/debut-wonderland/paper-arch-desktop-v1.webp" width={1536} height={1024} alt="" /></picture></div>
          <div ref={coverRef} className={styles.cover} data-testid="wonderland-cover"><div className={styles.coverMaterial} /><div className={styles.keyholePeek} data-keyhole-peek aria-hidden="true" /><div className={styles.keyholeRim} data-keyhole-rim aria-hidden="true"><Image src="/debut-wonderland/brass-keyhole-v2.webp" width={650} height={1138} alt="" unoptimized priority /></div></div>
          <div className={styles.coverHeading} data-opening-copy><span className={styles.kicker}>Maison de Moments · The debut collection</span><h2>Eighteen in<br /><em>Wonderland</em></h2><Ornament /><p>A story waiting to be opened</p></div>
          <div ref={keyRef} className={styles.goldenKey} data-testid="wonderland-key" aria-hidden="true"><div ref={keyTurnRef} className={styles.keyTurn} data-testid="wonderland-key-turn"><Image src="/debut-wonderland/golden-key-v1.webp" alt="" width={400} height={600} priority /></div></div>
          <div className={styles.openingPrompt} data-opening-copy>{stage === "sealed" ? <button ref={openRef} className={styles.openButton} disabled={!clientReady} onClick={() => void open()}>Turn the key <ArrowUpRight size={16} aria-hidden="true" /></button> : stage === "preparing" ? <p role="status">Preparing your story…</p> : null}<p className={styles.musicDisclosure}>Opens with piano music · Sound can be muted</p><small>A fictional invitation by Maison de Moments</small></div>
        </div>
        <div className={styles.theatrePlane} aria-hidden="true"><div ref={foregroundRef} className={styles.foreground} data-testid="wonderland-foreground"><ChapterArt kind="roses" /><ChapterArt kind="blue-bills" /></div></div>
        <div ref={introRef} className={styles.intro} aria-hidden={stage !== "intro"}><Ornament /><p>A little wonder.<br /><em>A beautiful new chapter.</em></p><Ornament /></div>
        {revealed && <div className={styles.heroCopy} data-testid="wonderland-invitation-card"><div className={styles.cardBorder} aria-hidden="true" /><span className={styles.kicker}>Chapter XVIII · An invitation</span><div className={styles.monogram} aria-hidden="true">{fixture.monogram}</div><p className={styles.host}>{fixture.hostWording}</p><h1 ref={heroRef} tabIndex={-1} id="invitation">{fixture.celebrant}</h1><p className={styles.invites}>invites you to a rather wonderful</p><p className={styles.eighteenth}>Eighteenth</p><p className={styles.kicker}>Birthday celebration</p><Ornament /><p className={styles.heroDate}>{fixture.dateLabel}</p><p>{fixture.timeLabel}</p><p className={styles.heroVenue}>{fixture.venue}<span>{fixture.address}</span></p><p className={styles.manila}>All times are in Manila time</p><button className={styles.continue} onClick={() => goTo("story")}>Follow the garden path <ArrowDown size={16} aria-hidden="true" /></button></div>}
      </section>
      {["preparing", "opening", "intro"].includes(stage) && <button className={styles.skip} onClick={reveal}>Skip to invitation <ArrowUpRight size={15} aria-hidden="true" /></button>}

      {revealed && <>
        <section className={styles.letter} id="story" tabIndex={-1} aria-labelledby="story-title"><div className={styles.letterCopy}><span className={styles.kicker}>Once upon a new beginning</span><h2 id="story-title">The loveliest adventures<br /><em>are shared.</em></h2><p>{fixture.message}</p><p className={styles.signature}>With love, {fixture.celebrant.split(" ")[0]}</p><Ornament /></div><div className={styles.catDelight}><button onClick={() => setSmiling((value) => !value)} className={styles.catButton} data-smiling={smiling} aria-label="Find the Cheshire Cat’s smile" aria-pressed={smiling}><Image src="/debut-wonderland/cheshire-cat-v1.webp" alt="" width={600} height={600} /><svg className={styles.catSmile} viewBox="0 0 100 45" aria-hidden="true"><path d="M15 12Q50 60 85 12Q50 35 15 12Z" fill="#fff5e2" stroke="#766580" strokeWidth="2" /><path d="M30 21v12M43 25v13M57 25v13M70 21v12" stroke="#766580" strokeWidth="1" /></svg></button><p>Every adventure begins with a smile.</p><span className={styles.small}>{smiling ? "A curious little smile, just for you." : "Tap the Cheshire Cat for a little surprise."}</span></div></section>

        <section className={styles.detailsSpread} aria-labelledby="details-title"><div className={styles.detailsPage}><span className={styles.kicker}>The invitation particulars</span><h2 id="details-title">Don’t be late<br /><em>for this lovely date.</em></h2><button className={styles.watchButton} onClick={(event) => showDetails(event.currentTarget)} aria-haspopup="dialog" aria-label="Open celebration details with the pocket watch"><Image src="/debut-wonderland/pocket-watch-v1.webp" width={450} height={450} alt="" /><span>View celebration details <ArrowUpRight size={14} aria-hidden="true" /></span></button><p className={styles.detailDate}>{fixture.dateLabel}<br /><span>{fixture.timeLabel} · Manila time</span></p><p>{fixture.venue}<br /><span className={styles.small}>{fixture.address}</span></p><Countdown fixture={fixture} /></div><div className={styles.attirePage}><span className={styles.kicker}>Dress for a little wonder</span><h3>A garden palette</h3><div className={styles.swatches} aria-label="Suggested attire colors"><span><i style={{ background: "#aec7d4" }} />Powder blue</span><span><i style={{ background: "#c58f91" }} />Dusty rose</span><span><i style={{ background: "#9da98c" }} />Sage</span></div><p>Formal garden-party attire in soft, dreamy colors. Please reserve ivory for the debutante.</p><ChapterArt kind="roses" /><p className={styles.italic}>Bring your lovely self.<br />We’ll take care of the wonder.</p></div></section>

        <section className={styles.programSpread} aria-labelledby="program-title"><div className={styles.programIllustration}><span className={styles.kicker}>A rather lovely itinerary</span><h2 id="program-title">The<br /><em>Tea Party</em></h2><ChapterArt kind="blue-bills" /><p>A table full of stories.<br />An evening full of memories.</p><span className={styles.folio}>II / THE CELEBRATION</span></div><ol className={styles.program}>{fixture.program.map((item) => <li key={`${item.time}-${item.title}`}><time>{item.time}</time><div><h3>{item.title}</h3><p>{item.detail}</p></div></li>)}</ol></section>

        {groups.length > 0 && <section className={styles.circle} id="circle" tabIndex={-1} aria-labelledby="circle-title"><header><span className={styles.kicker}>The people in her story</span><h2 id="circle-title">Her Wonderland<br /><em>Circle</em></h2><p>Every name, a cherished part of the adventure.</p><nav aria-label="Celebration groups">{groups.map((group) => <a href={`#${group.id}`} key={group.id} onClick={(event) => { event.preventDefault(); window.history.replaceState(null, "", `#${group.id}`); goTo(group.id); }}><span>{group.title}</span><ArrowDown size={14} aria-hidden="true" /></a>)}</nav></header>{groups.map((group, index) => <article className={styles.groupSpread} data-kind={group.id} id={group.id} tabIndex={-1} key={group.id} aria-labelledby={`${group.id}-title`}><div className={styles.groupArtPage}><span className={styles.kicker}>Chapter {String(index + 3).padStart(2, "0")}</span><ChapterArt kind={group.id} /><h3 id={`${group.id}-title`}>{group.title}</h3><p className={styles.chapterName}>{chapterNames[group.id]}</p><p>{group.introduction}</p><Ornament /><span className={styles.folio}>XVIII / WITH LOVE</span></div><div className={styles.groupNamesPage}><span className={styles.kicker}>Written in her story</span><ol>{group.members.map((member) => <li key={member.id}>{member.name}</li>)}</ol><span className={styles.folio}>{String(index + 3).padStart(2, "0")} / {group.title.toUpperCase()}</span></div></article>)}</section>}

        <section className={styles.rsvp} id="rsvp" tabIndex={-1} aria-labelledby="rsvp-title"><div className={styles.rsvpIllustration}><ChapterArt kind="blue-bills" /><p>There’s a place for you<br /><em>in this story.</em></p></div><div className={styles.replyCard}><div className={styles.cardBorder} aria-hidden="true" /><span className={styles.kicker}>The pleasure of your company</span><h2 id="rsvp-title">A Seat at<br /><em>the Table</em></h2><p>Kindly reply by {fixture.rsvpDeadline}.</p><Ornament /><p className={styles.sampleNotice}>This is a fictional sample. Try a response below.<br />No guest information is collected or submitted.</p><div className={styles.replyActions}><button className={styles.button} aria-pressed={reply === "yes"} onClick={() => setReply("yes")}>Joyfully accepts</button><button className={styles.button} aria-pressed={reply === "no"} onClick={() => setReply("no")}>Regretfully declines</button></div><div className={styles.replyStatus} role="status">{reply && `Sample response: ${reply === "yes" ? "joyfully accepts" : "regretfully declines"}. Nothing was submitted.`}</div><p className={styles.italic}>Your presence is the loveliest gift.</p><span className={styles.folio}>THE END / AND A NEW BEGINNING</span></div></section>

        <footer className={styles.footer}><div className={styles.monogram}>{fixture.monogram}</div><p>May the next chapter<br /><em>be full of wonder.</em></p><span>Eighteen in Wonderland · Maison de Moments</span><small>Fictional celebrant, participants, venue, and event.</small><p className={styles.musicCredit}>Music: <a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100044" target="_blank" rel="noreferrer">“There is Romance”</a> by Kevin MacLeod · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p><Link href="/designs/eighteen-in-wonderland">Discover this design <ArrowUpRight size={14} aria-hidden="true" /></Link></footer>
      </>}
      {revealed && <DialogContent className={styles.dialog} onCloseAutoFocus={(event) => { event.preventDefault(); if (dialogDestination.current) { goTo(dialogDestination.current); dialogDestination.current = null; } else detailTrigger.current?.focus(); }}><DialogTitle>Celebration details</DialogTitle><DialogDescription>A fictional eighteenth birthday in Wonderland.</DialogDescription><p>{fixture.dateLabel}<br />{fixture.timeLabel} · Manila time</p><p>{fixture.venue}<br />{fixture.address}</p><p>Formal garden-party attire in powder blue, dusty rose, or sage. Please reserve ivory for the debutante.</p><p>Kindly reply by {fixture.rsvpDeadline}.</p><button className={styles.button} onClick={() => { dialogDestination.current = "rsvp"; setDetailsOpen(false); }}>Go to RSVP</button></DialogContent>}
    </main>
  </Dialog>;
}
