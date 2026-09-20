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
      const back = new T.Mesh(new T.PlaneGeometry(1, 1), inside);
      back.position.z = -.08;
      stage.add(back);

      let cardMap = makeCardTexture(T, 1, paperMap.image);
      const cardMaterial = new T.MeshBasicMaterial({ map: cardMap });
      const card = new T.Mesh(new T.PlaneGeometry(1, 1), cardMaterial);
      card.position.z = -.01;
      stage.add(card);

      const front = new T.Mesh(new T.BufferGeometry(), face);
      front.position.z = .025;
      stage.add(front);
      const flap = new T.Group();
      const flapFace = new T.Mesh(new T.BufferGeometry(), flapMaterial);
      const flapReverse = new T.Mesh(new T.BufferGeometry(), flapReverseMaterial);
      flap.add(flapFace);
      flap.add(flapReverse);
      stage.add(flap);
      const sealMaterial = new T.MeshBasicMaterial({ map: sealMap, transparent: true, depthWrite: false });
      const seal = new T.Mesh(new T.PlaneGeometry(1, 1), sealMaterial);
      stage.add(seal);
      const shadowMap = makeShadowTexture(T);
      const shadowMaterial = new T.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: .45, depthWrite: false });
      const sealShadow = new T.Mesh(new T.PlaneGeometry(1, 1), shadowMaterial);
      stage.add(sealShadow);

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
        cardMap.dispose();
        cardMap = makeCardTexture(T, camera.aspect, paperMap.image);
        cardMaterial.map = cardMap;
        sealSize = Math.min(height * .184, width * .315);
        back.scale.set(width, height, 1);
        card.scale.set(width * .92, height * .92, 1);
        front.geometry.dispose();
        // A small overlap behind the curved flap prevents the card peeking out.
        front.geometry = geometry([[0, .35], [0.5, .645], [1, .35], [1, 1], [0, 1]]);
        flapFace.geometry.dispose();
        flapFace.geometry = geometry(flapOutline, true);
        flapReverse.geometry.dispose();
        flapReverse.geometry = flapFace.geometry.clone();
        flap.position.set(0, height / 2, .05);
        seal.position.set(0, -height * .149, .115);
        seal.scale.set(sealSize, sealSize, 1);
        sealShadow.position.set(sealSize * .04, -height * .149 - sealSize * .08, .08);
        sealShadow.scale.set(sealSize * 1.18, sealSize * 1.18, 1);
        requestRender();
      };
      fit();

      const resetScene = () => {
        timeline?.kill();
        playing = false;
        stage.position.set(0, 0, 0);
        stage.rotation.set(0, 0, 0);
        flap.rotation.x = 0;
        flapMaterial.color.set(0xffffff);
        card.position.set(0, 0, -.01);
        sealMaterial.opacity = 1;
        sealShadow.material.opacity = .45;
        seal.rotation.set(0, 0, 0);
        renderer.domElement.style.opacity = "1";
        fit();
      };
      const play = () => {
        if (playing) return;
        playing = true;
        const restingSealY = -height * .149;
        timeline = gsap.timeline({ onUpdate: requestRender });
        timeline
          .to(seal.scale, { x: sealSize * .94, y: sealSize * .94, duration: .16, ease: "power2.in" }, 0)
          .to(seal.position, { z: 2.3, y: restingSealY + .15, duration: .64, ease: "power2.out" }, .16)
          .to(seal.scale, { x: sealSize * 1.04, y: sealSize * 1.04, duration: .5 }, .16)
          .to(seal.rotation, { z: -.13, duration: .64 }, .16)
          .to(sealShadow.scale, { x: sealSize * 1.6, y: sealSize * 1.6, duration: .55 }, .16)
          .to(shadowMaterial, { opacity: 0, duration: .5 }, .3)
          .to(sealMaterial, { opacity: 0, duration: .3 }, .62)
          .to(flap.rotation, { x: -Math.PI * .97, duration: 1.6, ease: "power2.inOut" }, .74)
          .to(flapMaterial.color, { r: .76, g: .73, b: .68, duration: .65, yoyo: true, repeat: 1 }, .76)
          .to(card.position, { y: height * .38, duration: 1.0, ease: "power2.inOut" }, 2.0)
          // Lift clear of the pocket before moving toward the camera.
          .to(card.position, { z: .5, duration: .2 }, 2.95)
          .to(stage.position, { y: -height * .42, duration: 1.25, ease: "power2.inOut" }, 3.0)
          .to(card.position, { y: height * .43, z: 5.9, duration: 1.25, ease: "power2.inOut" }, 3.0)
          .to(renderer.domElement, { opacity: 0, duration: .45, onComplete: () => { playing = false; onComplete(); } }, 4.0);
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
        if (playing) { stop(); onComplete(); }
        else fit();
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
        [face, flapMaterial, flapReverseMaterial, inside, cardMaterial, sealMaterial, shadowMaterial].forEach((material) => material.dispose());
        [...textures, cardMap, shadowMap].forEach((texture) => texture.dispose());
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

function makeCardTexture(T: typeof import("three"), aspect: number, paperImage: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  canvas.height = 1500;
  canvas.width = Math.round(1500 * Math.min(2.2, Math.max(.4, aspect)));
  const width = canvas.width;
  const height = canvas.height;
  const typeSize = Math.min(width, height);
  const c = canvas.getContext("2d")!;
  c.drawImage(paperImage, 0, 0, width, height);
  c.fillStyle = "rgba(255, 248, 230, .16)";
  c.fillRect(0, 0, width, height);
  const edgeShade = c.createLinearGradient(0, 0, width, height);
  edgeShade.addColorStop(0, "rgba(104,78,38,.13)");
  edgeShade.addColorStop(.12, "rgba(104,78,38,0)");
  edgeShade.addColorStop(.88, "rgba(104,78,38,0)");
  edgeShade.addColorStop(1, "rgba(104,78,38,.12)");
  c.fillStyle = edgeShade;
  c.fillRect(0, 0, width, height);
  c.strokeStyle = "#c8b69a";
  c.lineWidth = 2;
  c.strokeRect(46, 46, width - 92, height - 92);
  c.textAlign = "center";
  c.fillStyle = "#514b3d";
  c.font = `${typeSize * .023}px Georgia`;
  c.fillText("TOGETHER WITH OUR FAMILIES", width / 2, height * .287);
  c.font = `${typeSize * .098}px Georgia`;
  c.fillText("Lorenzo", width / 2, height * .407);
  c.font = `italic ${typeSize * .058}px Georgia`;
  c.fillText("&", width / 2, height * .47);
  c.font = `${typeSize * .098}px Georgia`;
  c.fillText("Cham", width / 2, height * .54);
  c.font = `${typeSize * .029}px Georgia`;
  c.fillText("14 · 06 · 2027", width / 2, height * .65);
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
