"use client";

import { useEffect, useRef } from "react";

type Props = {
  opening: boolean;
  onReady: () => void;
  onComplete: () => void;
  onUnavailable: () => void;
};

// Coordinates are measured in the source photographs, before viewport cropping.
// Both paper meshes share this edge, including the rounded tip.
const mobileEdge: Array<[number, number]> = [
  [0,.3125],[.05,.3411],[.1,.3717],[.2,.4323],[.3,.4922],[.4,.5534],
  [.45,.584],[.47,.5957],[.48,.6022],[.49,.6074],[.5,.6094],
  [.51,.6068],[.52,.6009],[.53,.5951],[.55,.5827],[.6,.5508],
  [.7,.4915],[.8,.4323],[.9,.3711],[.95,.3405],[1,.3125],
];
const desktopEdge: Array<[number, number]> = [
  [0,.042],[.02,.0869],[.05,.1309],[.1,.2012],[.2,.3369],[.3,.4668],
  [.4,.5928],[.45,.6592],[.47,.6875],[.48,.6992],[.49,.709],[.5,.7119],
  [.51,.707],[.52,.6973],[.53,.6855],[.55,.6563],[.6,.5889],
  [.7,.4658],[.8,.3369],[.9,.2012],[.95,.1289],[.98,.084],[1,.0283],
];
const duration = 9_400;
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function BeachEnvelope({ opening, onReady, onComplete, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const openingRef = useRef(opening);
  const playRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    openingRef.current = opening;
    if (opening) playRef.current?.();
  }, [opening]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let dispose = () => {};
    void import("three").then(async (T) => {
      const loader = new T.TextureLoader();
      const loaded = await Promise.allSettled([
        loader.loadAsync("/beach-wedding/blue-envelope-mobile-centered.webp"),
        loader.loadAsync("/beach-wedding/blue-envelope-desktop.webp"),
        loader.loadAsync("/beach-wedding/shell-seal.webp"),
      ]);
      const textures = loaded.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      dispose = () => textures.forEach((texture) => texture.dispose());
      if (cancelled || loaded.some((result) => result.status === "rejected")) {
        dispose();
        if (!cancelled) onUnavailable();
        return;
      }
      textures.forEach((texture) => { texture.colorSpace = T.SRGBColorSpace; });
      const [mobileMap, desktopMap, shellMap] = textures;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = T.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      const scene = new T.Scene();
      // A long lens keeps the shell from ballooning as the flap approaches us.
      const camera = new T.PerspectiveCamera(12, 1, .1, 100);
      camera.position.z = 40;
      const worldH = 80 * Math.tan(T.MathUtils.degToRad(6));
      const stage = new T.Group();
      scene.add(stage);
      const frontMaterial = new T.MeshBasicMaterial({ map: desktopMap, side: T.DoubleSide });
      const flapMaterial = new T.MeshBasicMaterial({ map: desktopMap, side: T.FrontSide });
      const reverseMaterial = new T.MeshBasicMaterial({ color: 0xd3e2e1, side: T.BackSide });
      const shellMaterial = new T.MeshBasicMaterial({ map: shellMap, transparent: true, depthWrite: false, side: T.DoubleSide });
      const pocket = new T.Mesh(new T.BufferGeometry(), frontMaterial);
      const flap = new T.Group();
      const face = new T.Mesh(new T.BufferGeometry(), flapMaterial);
      const reverse = new T.Mesh(new T.BufferGeometry(), reverseMaterial);
      const shell = new T.Mesh(new T.PlaneGeometry(1, 1), shellMaterial);
      reverse.position.z = -.003;
      flap.add(face, reverse, shell);
      stage.add(pocket, flap);
      let frame = 0;
      let elapsed = 0;
      let last = 0;
      let playing = false;
      let finished = false;

      const fit = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        const mobile = w <= 700;
        const map = mobile ? mobileMap : desktopMap;
        const edge = mobile ? mobileEdge : desktopEdge;
        const sourceAspect = map.image.width / map.image.height;
        // Mobile is bottom-aligned at 128% height, putting the measured tip at 50%.
        const imageH = mobile ? h * 1.28 : h;
        const imageW = mobile ? imageH * sourceAspect : w;
        const imageTop = mobile ? h - imageH : 0;
        const unit = worldH / h;
        const width = imageW * unit;
        const height = imageH * unit;
        const tip = mobile ? .6094 : .7119;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        stage.position.y = (h / 2 - imageTop - imageH / 2) * unit;
        frontMaterial.map = flapMaterial.map = map;
        frontMaterial.needsUpdate = flapMaterial.needsUpdate = true;

        const geometry = (points: Array<[number, number]>, hinged: boolean) => {
          const shape = new T.Shape();
          points.forEach(([u, v], i) => {
            const x = (u - .5) * width;
            const y = (hinged ? -v : .5 - v) * height;
            if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
          });
          shape.closePath();
          const result = new T.ShapeGeometry(shape);
          const position = result.getAttribute("position");
          const uv = result.getAttribute("uv");
          for (let i = 0; i < position.count; i++) {
            uv.setXY(i, position.getX(i) / width + .5, position.getY(i) / height + (hinged ? 1 : .5));
          }
          return result;
        };
        pocket.geometry.dispose();
        pocket.geometry = geometry([...edge, [1,1], [0,1]], false);
        face.geometry.dispose();
        face.geometry = geometry([[0,0], [1,0], ...[...edge].reverse()], true);
        reverse.geometry.dispose();
        reverse.geometry = face.geometry.clone();
        // The hinge is the TOP of the paper, never where the diagonals hit the crop.
        flap.position.set(0, height / 2, .008);
        const shellSize = Math.min(195, h * .18, w * .32);
        shell.scale.setScalar(shellSize * unit);
        shell.position.set(0, -height * tip, .035);
        host.closest("section")?.style.setProperty("--seal-y", `${imageTop + imageH * tip}px`);
        renderer.render(scene, camera);
      };

      const tick = (now: number) => {
        frame = 0;
        if (cancelled || document.hidden || !playing) return;
        elapsed += now - last;
        last = now;
        const progress = Math.min(1, elapsed / duration);
        const visibleLift = 70 * smooth((progress - .04) / .58);
        const foldBack = 103 * smooth((progress - .62) / .26);
        flap.rotation.x = -T.MathUtils.degToRad(visibleLift + foldBack);
        // Once the flap lifts, let the pocket leave the frame so the open V
        // never sits over the scenery as a stationary triangular cutout.
        pocket.position.y = -worldH * 1.05 * smooth((progress - .3) / .6);
        camera.zoom = 1 + .08 * smooth(progress);
        camera.updateProjectionMatrix();
        const fade = smooth((progress - .77) / .23);
        renderer.domElement.style.opacity = String(1 - fade);
        host.dataset.progress = progress.toFixed(3);
        host.dataset.zoom = camera.zoom.toFixed(3);
        renderer.render(scene, camera);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else if (!finished) { finished = true; playing = false; onComplete(); }
      };
      const play = () => {
        if (playing || finished) return;
        playing = true;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      };
      const visibility = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        if (!document.hidden && playing) { last = performance.now(); frame = requestAnimationFrame(tick); }
      };
      const contextLost = (event: Event) => { event.preventDefault(); playing = false; cancelAnimationFrame(frame); onUnavailable(); };
      const resize = new ResizeObserver(fit);
      dispose = () => {
        playing = false;
        cancelAnimationFrame(frame);
        resize.disconnect();
        document.removeEventListener("visibilitychange", visibility);
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        [pocket.geometry, face.geometry, reverse.geometry, shell.geometry].forEach((geometry) => geometry.dispose());
        [frontMaterial, flapMaterial, reverseMaterial, shellMaterial].forEach((material) => material.dispose());
        textures.forEach((texture) => texture.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
      if (cancelled) { dispose(); return; }
      fit();
      resize.observe(host);
      document.addEventListener("visibilitychange", visibility);
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      playRef.current = play;
      host.dataset.ready = "true";
      onReady();
      if (openingRef.current) play();
    }).catch(() => { dispose(); if (!cancelled) onUnavailable(); });
    return () => { cancelled = true; playRef.current = null; dispose(); };
  }, [onReady, onComplete, onUnavailable]);

  return <div ref={hostRef} data-envelope-renderer data-progress="0" data-zoom="1" style={{ width: "100%", height: "100%" }} />;
}
