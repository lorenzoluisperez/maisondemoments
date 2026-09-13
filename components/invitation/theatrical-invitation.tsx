"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Menu, Sparkles, X } from "lucide-react";
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
  const [scene, setScene] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rsvp, setRsvp] = useState<RsvpChoice>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const current = sceneKeys[scene];
  const collectionClass = snapshot.config.themeVersion.startsWith("luminous-parchment") ? "collection-luminous" : "collection-midnight";

  const move = (next: number) => setScene(Math.max(0, Math.min(sceneKeys.length - 1, next)));
  const goTo = useCallback((key: SceneKey) => setScene(Math.max(0, sceneKeys.indexOf(key))), [sceneKeys]);
  const submitRsvp = useCallback((choice: Exclude<RsvpChoice, null>) => {
    setRsvp(choice);
    goTo("rsvp");
    return { status: choice, household: "The Flores household", seats: choice === "ATTENDING" ? 2 : 0 };
  }, [goTo]);

  useLayoutEffect(() => {
    if (!sceneRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      const context = gsap.context(() => {
        gsap.fromTo("[data-animate]", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.72, stagger: 0.08, ease: "power3.out" });
      }, sceneRef);
      return () => context.revert();
    } catch {
      sceneRef.current.querySelectorAll<HTMLElement>("[data-animate]").forEach((element) => {
        element.style.opacity = "1";
        element.style.visibility = "visible";
        element.style.transform = "none";
      });
    }
  }, [scene]);

  useEffect(() => {
    if (!detailsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDetailsOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailsOpen]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const ignoreRegistrationError = () => undefined;
    void Promise.resolve(context.registerTool({
      name: "navigate_invitation_scene",
      title: "Navigate invitation",
      description: "Open a named scene in the currently visible invitation.",
      inputSchema: { type: "object", properties: { scene: { type: "string", enum: sceneKeys } }, required: ["scene"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const requested = (input as { scene?: SceneKey })?.scene;
        if (!requested || !sceneKeys.includes(requested)) throw new Error("Unknown invitation scene");
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

  const firstActivity = snapshot.activities[0];

  return (
    <main className={`invitation-shell ${collectionClass}`}>
      <nav className="invitation-nav" aria-label="Invitation controls">
        <button className="brand-mark" onClick={() => move(0)} aria-label="Return to opening">
          <span>MM</span><span className="brand-name">Maison de Moments</span>
        </button>
        <div className="nav-actions">
          <button className="nav-button" onClick={() => setDetailsOpen(true)}><Menu size={16} aria-hidden="true" /><span>Details</span></button>
          <button className="nav-button" onClick={() => goTo("rsvp")}>RSVP</button>
        </div>
      </nav>

      <section className="stage" aria-live="polite">
        <Image className="botanical botanical-left" src="/maison-botanical.webp" width="768" height="1152" alt="" priority loading="eager" />
        <Image className="botanical botanical-right" src="/maison-botanical.webp" width="768" height="1152" alt="" loading="eager" />
        <div ref={sceneRef} className="scene-frame" key={current}>
          {current === "opening" && (
            <div className="scene opening-scene">
              <p className="eyebrow" data-animate>You are warmly invited</p>
              <button className="envelope" onClick={() => move(1)} aria-label="Open the invitation" data-animate>
                <span className="envelope-flap" /><span className="wax-seal">M</span>
              </button>
              <p className="tap-copy" data-animate>Tap the seal to begin</p>
            </div>
          )}

          {current === "welcome" && (
            <div className="scene hero-scene">
              <p className="eyebrow" data-animate>{snapshot.hostWording}</p>
              <h1 data-animate>
                <span>{snapshot.title}</span>
                {snapshot.secondaryName && <><em>&amp;</em><span>{snapshot.secondaryName}</span></>}
              </h1>
              <div className="ornament" data-animate><Sparkles size={17} /> {snapshot.dateLabel} <Sparkles size={17} /></div>
              {snapshot.story && <p className="scene-copy" data-animate>{snapshot.story}</p>}
            </div>
          )}

          {current === "details" && (
            <div className="scene details-scene">
              <p className="eyebrow" data-animate>The celebration</p>
              <h2 data-animate>A day to remember</h2>
              <div className="detail-grid" data-animate>
                <article><CalendarDays /><span>Date</span><strong>{snapshot.dateLabel}</strong></article>
                <article><Clock3 /><span>{firstActivity.label}</span><strong>{firstActivity.timeLabel}</strong></article>
                <article><MapPin /><span>Venue</span><strong>{firstActivity.venueName}</strong></article>
              </div>
              <a className="text-link" href={firstActivity.mapUrl} target="_blank" rel="noreferrer" data-animate>Open directions</a>
            </div>
          )}

          {current === "participants" && (
            <div className="scene entourage-scene">
              <p className="eyebrow" data-animate>With love and guidance</p>
              <h2 data-animate>{snapshot.eventType === "debut" ? "The 18 candles" : snapshot.eventType === "christening" ? "Our godparents" : "Our wedding party"}</h2>
              <div className="name-columns" data-animate>
                {snapshot.participants.map((person, index) => <div key={index}><span>{person.roleLabel}</span><strong>{person.displayName}</strong></div>)}
              </div>
            </div>
          )}

          {current === "rsvp" && (
            <div className="scene rsvp-scene" id="rsvp">
              <p className="eyebrow" data-animate>Kindly respond by {snapshot.rsvpDeadlineLabel}</p>
              <h2 data-animate>{rsvp ? "Your reply is saved" : "Will you celebrate with us?"}</h2>
              <p className="household-note" data-animate>The Flores household · 2 seats reserved</p>
              {rsvp ? (
                <div className="rsvp-confirmation" data-animate>
                  <strong>{rsvp === "ATTENDING" ? "Joyfully attending · 2 guests" : "Regretfully declined"}</strong>
                  <button className="secondary-action" onClick={() => setRsvp(null)}>Change response</button>
                </div>
              ) : (
                <div className="rsvp-options" data-animate>
                  <button className="primary-action" onClick={() => submitRsvp("ATTENDING")}>Joyfully accepts</button>
                  <button className="secondary-action" onClick={() => submitRsvp("DECLINED")}>Regretfully declines</button>
                </div>
              )}
              <p className="scene-copy" data-animate>Your response can be updated until the RSVP deadline.</p>
            </div>
          )}
        </div>
      </section>

      {scene > 0 && (
        <div className="scene-controls">
          <button onClick={() => move(scene - 1)} aria-label="Previous scene"><ChevronLeft /></button>
          <div className="scene-progress" aria-label={`Scene ${scene + 1} of ${sceneKeys.length}`}>
            {sceneKeys.slice(1).map((label, index) => <button key={label} className={scene === index + 1 ? "active" : ""} onClick={() => move(index + 1)} aria-label={`Go to ${label}`} />)}
          </div>
          <button onClick={() => move(scene + 1)} disabled={scene === sceneKeys.length - 1} aria-label="Next scene"><ChevronRight /></button>
        </div>
      )}

      {detailsOpen && (
        <div className="details-overlay" role="dialog" aria-modal="true" aria-labelledby="details-title" onMouseDown={(event) => { if (event.currentTarget === event.target) setDetailsOpen(false); }}>
          <div className="details-panel">
            <button className="close-button" onClick={() => setDetailsOpen(false)} aria-label="Close details" autoFocus><X /></button>
            <p className="eyebrow">At a glance</p>
            <h2 id="details-title">{snapshot.title}{snapshot.secondaryName ? ` & ${snapshot.secondaryName}` : ""}</h2>
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
