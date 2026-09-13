"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Clock3, MapPin, Menu, Sparkles, X } from "lucide-react";
import { gsap } from "gsap";
import Image from "next/image";
import type { InvitationSnapshot } from "@/lib/invitation/config";

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
          execute(input: unknown): unknown;
        },
        options?: { signal?: AbortSignal },
      ): void | Promise<void>;
    };
  }
}

type SceneKey = "opening" | "welcome" | "details" | "participants" | "rsvp";
type RsvpChoice = "ATTENDING" | "DECLINED" | null;

export function TheatricalInvitation({ snapshot }: { snapshot: InvitationSnapshot }) {
  const sceneKeys = useMemo<SceneKey[]>(
    () => ["opening", "welcome", "details", ...(snapshot.participants.length ? ["participants" as const] : []), "rsvp"],
    [snapshot.participants.length],
  );
  const [activeScene, setActiveScene] = useState<SceneKey>("opening");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rsvp, setRsvp] = useState<RsvpChoice>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const luminous = snapshot.config.themeVersion.startsWith("luminous-parchment");
  const collectionClass = luminous ? "collection-luminous" : "collection-midnight";

  const goTo = useCallback((key: SceneKey) => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`scene-${key}`)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }, []);

  const submitRsvp = useCallback((choice: Exclude<RsvpChoice, null>) => {
    setRsvp(choice);
    goTo("rsvp");
    return { status: choice, household: "The Flores household", seats: choice === "ATTENDING" ? 2 : 0 };
  }, [goTo]);

  useLayoutEffect(() => {
    const root = storyRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const animated = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || animated.has(entry.target)) return;
        animated.add(entry.target);
        const items = entry.target.querySelectorAll("[data-reveal]");
        try {
          gsap.fromTo(items, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.78, stagger: 0.09, ease: "power3.out", clearProps: "transform,opacity,visibility" });
        } catch {
          items.forEach((item) => (item as HTMLElement).removeAttribute("style"));
        }
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16 });

    root.querySelectorAll("[data-story-section]").forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sections = sceneKeys
      .map((key) => document.getElementById(`scene-${key}`))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveScene(visible.target.id.replace("scene-", "") as SceneKey);
    }, { rootMargin: "-25% 0px -55%", threshold: [0, 0.25, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [sceneKeys]);

  useEffect(() => {
    if (!detailsOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDetailsOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [detailsOpen]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const ignoreRegistrationError = () => undefined;
    void Promise.resolve(context.registerTool({
      name: "navigate_invitation_scene",
      title: "Navigate invitation",
      description: "Scroll to a named section in the currently visible invitation.",
      inputSchema: { type: "object", properties: { scene: { type: "string", enum: sceneKeys } }, required: ["scene"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const requested = (input as { scene?: SceneKey })?.scene;
        if (!requested || !sceneKeys.includes(requested)) throw new Error("Unknown invitation section");
        goTo(requested);
        return { scene: requested };
      },
    }, { signal: lifecycle.signal })).catch(ignoreRegistrationError);
    void Promise.resolve(context.registerTool({
      name: "submit_demo_household_rsvp",
      title: "Submit demo RSVP",
      description: "Record the visible demo household as attending or declined.",
      inputSchema: { type: "object", properties: { status: { type: "string", enum: ["ATTENDING", "DECLINED"] } }, required: ["status"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const status = (input as { status?: string })?.status;
        if (status !== "ATTENDING" && status !== "DECLINED") throw new Error("Status must be ATTENDING or DECLINED");
        return submitRsvp(status);
      },
    }, { signal: lifecycle.signal })).catch(ignoreRegistrationError);
    return () => lifecycle.abort();
  }, [goTo, sceneKeys, submitRsvp]);

  return (
    <main className={`invitation-shell scrollable-invitation ${collectionClass}`}>
      <nav className="invitation-nav" aria-label="Invitation controls">
        <button className="brand-mark" onClick={() => goTo("opening")} aria-label="Return to invitation opening">
          <span>MM</span><span className="brand-name">Maison de Moments</span>
        </button>
        <div className="nav-actions">
          <button className="nav-button" onClick={() => setDetailsOpen(true)} aria-label="Open event details"><Menu size={16} aria-hidden="true" /><span>Details</span></button>
          <button className="nav-button" onClick={() => goTo("rsvp")}>RSVP</button>
        </div>
      </nav>

      <div className="story-progress" aria-label="Invitation sections">
        {sceneKeys.map((key) => (
          <button key={key} className={activeScene === key ? "active" : ""} onClick={() => goTo(key)} aria-label={`Go to ${key}`} aria-current={activeScene === key ? "location" : undefined}>
            <span>{key}</span>
          </button>
        ))}
      </div>

      <div className="scroll-story" ref={storyRef}>
        <section id="scene-opening" className="story-section opening-section" data-story-section aria-labelledby="opening-label">
          <CollectionArtwork luminous={luminous} placement="opening" priority />
          <div className="story-content opening-content">
            <p className="eyebrow" id="opening-label" data-reveal>You are warmly invited</p>
            <button className="envelope" onClick={() => goTo("welcome")} aria-label="Continue to the invitation" data-reveal>
              <span className="envelope-flap" /><span className="wax-seal">M</span>
            </button>
            <button className="scroll-cue" onClick={() => goTo("welcome")} data-reveal>Scroll to begin <ChevronDown aria-hidden="true" /></button>
          </div>
        </section>

        <section id="scene-welcome" className="story-section welcome-section" data-story-section aria-labelledby="invitation-title">
          <CollectionArtwork luminous={luminous} placement="welcome" />
          <div className="story-content hero-scene">
            <p className="eyebrow" data-reveal>{snapshot.hostWording}</p>
            <h1 id="invitation-title" data-reveal>
              <span>{snapshot.title}</span>
              {snapshot.secondaryName && <><em>&amp;</em><span>{snapshot.secondaryName}</span></>}
            </h1>
            <div className="ornament" data-reveal><Sparkles size={17} /> {snapshot.dateLabel} <Sparkles size={17} /></div>
            {snapshot.story && <p className="scene-copy" data-reveal>{snapshot.story}</p>}
          </div>
        </section>

        <section id="scene-details" className="story-section details-section" data-story-section aria-labelledby="details-heading">
          <CollectionArtwork luminous={luminous} placement="details" />
          <div className="story-content details-scene">
            <p className="eyebrow" data-reveal>The celebration</p>
            <h2 id="details-heading" data-reveal>A day to remember</h2>
            <div className="date-feature" data-reveal><CalendarDays aria-hidden="true" /><span>Date</span><strong>{snapshot.dateLabel}</strong></div>
            <div className="activity-list">
              {snapshot.activities.map((activity) => (
                <article className="activity-card" key={activity.id} data-reveal>
                  <div><Clock3 aria-hidden="true" /><span>{activity.label}</span><strong>{activity.timeLabel}</strong></div>
                  <div><MapPin aria-hidden="true" /><span>{activity.venueName}</span><p>{activity.address}</p></div>
                  <a className="text-link" href={activity.mapUrl} target="_blank" rel="noreferrer">Open directions</a>
                </article>
              ))}
            </div>
            {snapshot.dressCode && <p className="dress-code" data-reveal><span>Dress code</span>{snapshot.dressCode}</p>}
          </div>
        </section>

        {snapshot.participants.length > 0 && (
          <section id="scene-participants" className="story-section participants-section" data-story-section aria-labelledby="participants-heading">
            <CollectionArtwork luminous={luminous} placement="participants" />
            <div className="story-content entourage-scene">
              <p className="eyebrow" data-reveal>With love and guidance</p>
              <h2 id="participants-heading" data-reveal>{participantHeading(snapshot.eventType)}</h2>
              <div className="name-columns">
                {snapshot.participants.map((person, index) => <div key={`${person.roleLabel}-${index}`} data-reveal><span>{person.roleLabel}</span><strong>{person.displayName}</strong></div>)}
              </div>
            </div>
          </section>
        )}

        <section id="scene-rsvp" className="story-section rsvp-section" data-story-section aria-labelledby="rsvp-heading">
          <CollectionArtwork luminous={luminous} placement="rsvp" />
          <div className="story-content rsvp-scene">
            <p className="eyebrow" data-reveal>Kindly respond by {snapshot.rsvpDeadlineLabel}</p>
            <h2 id="rsvp-heading" data-reveal>{rsvp ? "Your reply is saved" : "Will you celebrate with us?"}</h2>
            <p className="household-note" data-reveal>The Flores household · 2 seats reserved</p>
            {rsvp ? (
              <div className="rsvp-confirmation" role="status" data-reveal>
                <strong>{rsvp === "ATTENDING" ? "Joyfully attending · 2 guests" : "Regretfully declined"}</strong>
                <button className="secondary-action" onClick={() => setRsvp(null)}>Change response</button>
              </div>
            ) : (
              <div className="rsvp-options" data-reveal>
                <button className="primary-action" onClick={() => submitRsvp("ATTENDING")}>Joyfully accepts</button>
                <button className="secondary-action" onClick={() => submitRsvp("DECLINED")}>Regretfully declines</button>
              </div>
            )}
            <p className="scene-copy" data-reveal>Your response can be updated until the RSVP deadline.</p>
            <div className="closing-mark" data-reveal><span>MM</span><p>Made with care by Maison de Moments</p></div>
          </div>
        </section>
      </div>

      {detailsOpen && (
        <div className="details-overlay" role="dialog" aria-modal="true" aria-labelledby="quick-details-title" onMouseDown={(event) => { if (event.currentTarget === event.target) setDetailsOpen(false); }}>
          <div className="details-panel">
            <button className="close-button" onClick={() => setDetailsOpen(false)} aria-label="Close details" autoFocus><X /></button>
            <p className="eyebrow">At a glance</p>
            <h2 id="quick-details-title">{snapshot.title}{snapshot.secondaryName ? ` & ${snapshot.secondaryName}` : ""}</h2>
            <dl>
              <div><dt>Date</dt><dd>{snapshot.dateLabel}</dd></div>
              {snapshot.activities.map((activity) => <div key={activity.id}><dt>{activity.label}</dt><dd>{activity.timeLabel} · {activity.venueName}</dd></div>)}
              {snapshot.dressCode && <div><dt>Dress code</dt><dd>{snapshot.dressCode}</dd></div>}
            </dl>
            <button className="primary-action" onClick={() => { setDetailsOpen(false); goTo("rsvp"); }}>Go to RSVP</button>
          </div>
        </div>
      )}
    </main>
  );
}

function CollectionArtwork({ luminous, placement, priority = false }: { luminous: boolean; placement: SceneKey; priority?: boolean }) {
  if (luminous) return <div className={`luminous-backdrop luminous-${placement}`} aria-hidden="true" />;
  return (
    <div className={`botanical-frame botanical-${placement}`} aria-hidden="true">
      <Image src="/maison-botanical.webp" width="768" height="1152" alt="" priority={priority} loading="eager" />
    </div>
  );
}

function participantHeading(type: InvitationSnapshot["eventType"]) {
  if (type === "debut") return "The 18 candles";
  if (type === "christening") return "Our godparents";
  return "Our wedding party";
}
