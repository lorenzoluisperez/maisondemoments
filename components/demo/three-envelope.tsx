"use client";

import { useEffect, useRef } from "react";

type Props = {
  run: number;
  reset: number;
  active: boolean;
  onReady: () => void;
  onComplete: () => void;
  onUnavailable: () => void;
};

// UV coordinates follow the actual folded edge in envelope-cotton-v3.webp.
// Every surface uses the same photograph, so the closed envelope has no seams
// between independently generated materials.
const flapOutline: Array<[number, number]> = [
  [0, 0], [1, 0], [1, .372], [.985, .401], [.94, .43],
  [.57, .642], [.53, .656], [.5, .66], [.47, .656], [.43, .642],
  [.06, .43], [.015, .401], [0, .372],
];

export function ThreeEnvelope({ run, reset, active, onReady, onComplete, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const sceneRef = useRef<{ play: () => void; reset: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let dispose = () => {};

    void Promise.all([import("three"), import("gsap")]).then(async ([T, { gsap }]) => {
      const loader = new T.TextureLoader();
      const loaded = await Promise.allSettled([
        loader.loadAsync("/wedding-showcase/envelope-cotton-v3.webp"),
        loader.loadAsync("/wedding-showcase/wax-lc-v3.webp"),
        loader.loadAsync("/wedding-showcase/cotton-card-v4.webp"),
      ]);
      const textures = loaded.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      if (cancelled || loaded.some((result) => result.status === "rejected")) {
        textures.forEach((texture) => texture.dispose());
        if (!cancelled) onUnavailable();
        return;
      }
      const [envelopeMap, sealMap, paperMap] = textures;
      textures.forEach((texture) => { texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4; });
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      renderer.outputColorSpace = T.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(35, 1, .1, 80);
      camera.position.z = 14;
      const stage = new T.Group();
      scene.add(stage);
      // Texture lighting is already photographic. Avoid lighting it twice.
      const face = new T.MeshBasicMaterial({ map: envelopeMap, side: T.DoubleSide });
      const flapMaterial = face.clone();
      flapMaterial.side = T.FrontSide;
      const inside = new T.MeshBasicMaterial({ map: paperMap, color: 0xe3d9c7, side: T.DoubleSide });
      const flapReverseMaterial = new T.MeshBasicMaterial({ map: paperMap, side: T.BackSide });
      const interiorLightMap = makeInteriorLightTexture(T);
      const interiorLightMaterial = new T.MeshBasicMaterial({
        map: interiorLightMap,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        side: T.BackSide,
        toneMapped: false,
      });
      const back = new T.Mesh(new T.PlaneGeometry(1, 1), inside);
      back.position.z = -.08;
      stage.add(back);
      const backLightMaterial = new T.MeshBasicMaterial({
        color: 0xfffdf5,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: T.DoubleSide,
        toneMapped: false,
      });
      const backLight = new T.Mesh(new T.PlaneGeometry(1, 1), backLightMaterial);
      backLight.position.z = -.07;
      stage.add(backLight);

      const front = new T.Mesh(new T.BufferGeometry(), face);
      front.position.z = .025;
      stage.add(front);
      const flap = new T.Group();
      const flapFace = new T.Mesh(new T.BufferGeometry(), flapMaterial);
      const flapReverse = new T.Mesh(new T.BufferGeometry(), flapReverseMaterial);
      const interiorLight = new T.Mesh(new T.BufferGeometry(), interiorLightMaterial);
      interiorLight.renderOrder = 4;
      flap.add(flapFace);
      flap.add(flapReverse);
      flap.add(interiorLight);
      stage.add(flap);
      const sealMaterial = new T.MeshBasicMaterial({ map: sealMap, transparent: true, depthWrite: false, side: T.DoubleSide });
      const seal = new T.Mesh(new T.PlaneGeometry(1, 1), sealMaterial);
      const shadowMap = makeShadowTexture(T);
      const shadowMaterial = new T.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: .45, depthWrite: false });
      const sealShadow = new T.Mesh(new T.PlaneGeometry(1, 1), shadowMaterial);
      flap.add(sealShadow);
      flap.add(seal);

      let width = 1;
      let height = 1;
      let sealSize = 1;
      let frame = 0;
      let playing = false;
      let timeline: ReturnType<typeof gsap.timeline> | null = null;

      const geometry = (points: Array<[number, number]>, hinged = false) => {
        const shape = new T.Shape();
        points.forEach(([u, v], index) => {
          const x = (u - .5) * width;
          const y = (hinged ? -v : .5 - v) * height;
          if (index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
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

      const render = () => {
        frame = 0;
        if (document.hidden || !activeRef.current) return;
        renderer.render(scene, camera);
        if (playing) frame = requestAnimationFrame(render);
      };
      const requestRender = () => { if (!frame) frame = requestAnimationFrame(render); };
      const fit = () => {
        renderer.setSize(host.clientWidth, host.clientHeight);
        camera.aspect = host.clientWidth / host.clientHeight;
        camera.updateProjectionMatrix();
        height = 2 * 14 * Math.tan(T.MathUtils.degToRad(35 / 2)) * 1.012;
        width = height * camera.aspect;
        sealSize = Math.min(height * .184, width * .315);
        back.scale.set(width, height, 1);
        backLight.scale.set(width, height, 1);
        front.geometry.dispose();
        // A small overlap behind the curved flap prevents the card peeking out.
        front.geometry = geometry([[0, .35], [0.5, .645], [1, .35], [1, 1], [0, 1]]);
        flapFace.geometry.dispose();
        flapFace.geometry = geometry(flapOutline, true);
        flapReverse.geometry.dispose();
        flapReverse.geometry = flapFace.geometry.clone();
        interiorLight.geometry.dispose();
        interiorLight.geometry = flapFace.geometry.clone();
        flap.position.set(0, height / 2, .05);
        seal.position.set(0, -height * .649, .115);
        seal.scale.set(sealSize, sealSize, 1);
        sealShadow.position.set(sealSize * .04, -height * .649 - sealSize * .08, .08);
        sealShadow.scale.set(sealSize * 1.18, sealSize * 1.18, 1);
        requestRender();
      };
      fit();

      const resetScene = () => {
        timeline?.kill();
        playing = false;
        stage.position.set(0, 0, 0);
        stage.scale.set(1, 1, 1);
        stage.rotation.set(0, 0, 0);
        camera.position.set(0, 0, 14);
        flap.rotation.x = 0;
        flapMaterial.color.set(0xffffff);
        backLightMaterial.opacity = 0;
        interiorLightMaterial.opacity = 0;
        sealMaterial.opacity = 1;
        shadowMaterial.opacity = .45;
        seal.rotation.set(0, 0, 0);
        renderer.domElement.style.opacity = "1";
        fit();
      };
      const play = () => {
        if (playing) return;
        playing = true;
        timeline = gsap.timeline({ onUpdate: requestRender });
        timeline
          .to(flap.rotation, { x: -Math.PI * .96, duration: 5.6, ease: "power2.inOut" }, .2)
          .to(flapMaterial.color, { r: .82, g: .79, b: .74, duration: 2.65, yoyo: true, repeat: 1 }, .28)
          .to(backLightMaterial, { opacity: .96, duration: 1.25, ease: "sine.out" }, .12)
          .to(interiorLightMaterial, { opacity: .96, duration: 1.35, ease: "sine.out" }, .12)
          .to(stage.position, { y: -height * .18, duration: 7.7, ease: "power1.inOut" }, .66)
          .to(camera.position, { z: 2.25, duration: 7.7, ease: "power2.inOut" }, .66)
          .to(interiorLightMaterial, { opacity: 1, duration: 3.4, ease: "power1.in" }, 3.9)
          .to(renderer.domElement, { opacity: .55, duration: 2, ease: "power1.out" }, 2.2)
          .to(renderer.domElement, { opacity: 0, duration: 4.6, ease: "none", onComplete: () => { playing = false; onComplete(); } }, 4.2);
        requestRender();
      };
      const stop = () => {
        playing = false;
        timeline?.pause();
        cancelAnimationFrame(frame);
        frame = 0;
      };
      const visibility = () => {
        if (document.hidden) { timeline?.pause(); cancelAnimationFrame(frame); frame = 0; }
        else if (activeRef.current) { if (playing) timeline?.resume(); requestRender(); }
      };
      const resize = () => {
        if (!playing) { fit(); return; }
        renderer.setSize(host.clientWidth, host.clientHeight);
        camera.aspect = host.clientWidth / host.clientHeight;
        camera.updateProjectionMatrix();
        requestRender();
      };
      const contextLost = (event: Event) => { event.preventDefault(); stop(); onUnavailable(); };
      window.addEventListener("resize", resize);
      document.addEventListener("visibilitychange", visibility);
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      sceneRef.current = { play, reset: resetScene, stop };
      dispose = () => {
        stop();
        timeline?.kill();
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", visibility);
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        scene.traverse((object) => {
          if (object instanceof T.Mesh) object.geometry.dispose();
        });
        [face, flapMaterial, flapReverseMaterial, backLightMaterial, interiorLightMaterial, inside, sealMaterial, shadowMaterial].forEach((material) => material.dispose());
        [...textures, interiorLightMap, shadowMap].forEach((texture) => texture.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
      if (cancelled) dispose(); else onReady();
    }).catch(() => { dispose(); if (!cancelled) onUnavailable(); });
    return () => { cancelled = true; dispose(); sceneRef.current = null; };
  }, [onReady, onComplete, onUnavailable]);

  useEffect(() => { activeRef.current = active; if (!active) sceneRef.current?.stop(); }, [active]);
  useEffect(() => { if (reset > 0) sceneRef.current?.reset(); }, [reset]);
  useEffect(() => { if (run > 0) sceneRef.current?.play(); }, [run]);
  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}

function makeInteriorLightTexture(T: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;

  c.fillStyle = "rgba(255,253,245,.98)";
  c.fillRect(0, 0, 512, 512);

  const main = c.createRadialGradient(256, 296, 12, 256, 296, 460);
  main.addColorStop(0, "rgba(255,255,244,.98)");
  main.addColorStop(.28, "rgba(255,241,190,.84)");
  main.addColorStop(.62, "rgba(255,225,146,.46)");
  main.addColorStop(.84, "rgba(255,241,205,.18)");
  main.addColorStop(1, "rgba(255,244,214,.12)");
  c.fillStyle = main;
  c.fillRect(0, 0, 512, 512);

  c.globalCompositeOperation = "lighter";
  const left = c.createRadialGradient(184, 286, 10, 184, 286, 220);
  left.addColorStop(0, "rgba(255,248,214,.52)");
  left.addColorStop(.5, "rgba(255,224,145,.2)");
  left.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = left;
  c.fillRect(0, 0, 512, 512);

  const right = c.createRadialGradient(338, 270, 10, 338, 270, 235);
  right.addColorStop(0, "rgba(255,255,232,.48)");
  right.addColorStop(.52, "rgba(255,236,177,.18)");
  right.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = right;
  c.fillRect(0, 0, 512, 512);

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

function makeShadowTexture(T: typeof import("three")) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  const gradient = c.createRadialGradient(64, 64, 20, 64, 64, 64);
  gradient.addColorStop(0, "rgba(48,31,15,.65)");
  gradient.addColorStop(.65, "rgba(48,31,15,.28)");
  gradient.addColorStop(1, "rgba(48,31,15,0)");
  c.fillStyle = gradient;
  c.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(canvas);
}
