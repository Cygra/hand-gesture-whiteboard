import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { stepPhysics } from "@/lib/balloon/physics";
import { THEME_PALETTES } from "@/lib/themes";
import type { ThreeState, BalloonState, ThemeMode, WindVector } from "@/lib/types";
import { MAX_FRAME_TIME_SECONDS } from "@/lib/constants";

type UseThreeSceneOptions = {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  themeMode: ThemeMode;
  balloonStateRef: MutableRefObject<BalloonState>;
  windStateRef: MutableRefObject<WindVector>;
  windTargetRef: MutableRefObject<WindVector>;
  enableBalloonFallRef: MutableRefObject<boolean>;
  onResize: (width: number, height: number) => void;
};

export function useThreeScene({
  containerRef,
  themeMode,
  balloonStateRef,
  windStateRef,
  windTargetRef,
  enableBalloonFallRef,
  onResize,
}: UseThreeSceneOptions): {
  threeRef: MutableRefObject<ThreeState | null>;
  canvasSizeRef: MutableRefObject<{ width: number; height: number }>;
} {
  const threeRef = useRef<ThreeState | null>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  // Use a ref to always read latest themeMode inside the resize closure
  const themeModeRef = useRef(themeMode);

  useEffect(() => {
    themeModeRef.current = themeMode;
  }, [themeMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = THEME_PALETTES[themeModeRef.current];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.sceneBackground);
    scene.fog = new THREE.Fog(palette.fog, 300, 2300);

    const camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      1,
      5000
    );
    camera.position.set(0, 0, 1120);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight("#ffffff", 0.86);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight("#b8dcff", 1.08);
    keyLight.position.set(220, 300, 500);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight("#c58cff", 0.85, 2600);
    rimLight.position.set(-260, 120, 420);
    scene.add(rimLight);

    const tankDepth = Math.max(
      320,
      Math.min(window.innerWidth, window.innerHeight) * 0.62
    );
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(window.innerWidth, tankDepth),
      new THREE.MeshStandardMaterial({
        color: palette.floor,
        roughness: 0.92,
        metalness: 0.08,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -window.innerHeight / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    balloonStateRef.current.tankDepth = tankDepth;

    const boxGeometry = new THREE.BoxGeometry(
      window.innerWidth,
      window.innerHeight,
      tankDepth
    );
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const tank = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: palette.tank,
        transparent: true,
        opacity: 0.42,
      })
    );
    scene.add(tank);

    const driftParticles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: palette.particle,
        size: 2,
        transparent: true,
        opacity: 0.5,
      })
    );
    const particleCount = 260;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * window.innerWidth;
      positions[i * 3 + 1] = (Math.random() - 0.5) * window.innerHeight;
      positions[i * 3 + 2] = (Math.random() - 0.5) * tankDepth;
    }
    driftParticles.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    scene.add(driftParticles);

    const three: ThreeState = {
      scene,
      camera,
      renderer,
      tank,
      floor,
      driftParticles,
      animationFrame: 0,
      leftWall: -window.innerWidth / 2,
      rightWall: window.innerWidth / 2,
      topWall: window.innerHeight / 2,
      bottomWall: -window.innerHeight / 2,
      backWall: -tankDepth / 2,
      frontWall: tankDepth / 2,
    };
    threeRef.current = three;

    let previous = performance.now();
    const animate = () => {
      if (!threeRef.current) return;
      const now = performance.now();
      const deltaSeconds = Math.min(
        (now - previous) / 1000,
        MAX_FRAME_TIME_SECONDS
      );
      previous = now;

      stepPhysics(
        deltaSeconds,
        balloonStateRef.current,
        threeRef.current,
        windStateRef.current,
        windTargetRef.current,
        enableBalloonFallRef.current
      );

      const attrs = driftParticles.geometry.getAttribute("position");
      for (let i = 0; i < attrs.count; i++) {
        const y = attrs.getY(i) - deltaSeconds * 10;
        attrs.setY(i, y < three.bottomWall ? three.topWall : y);
      }
      attrs.needsUpdate = true;

      three.renderer.render(three.scene, three.camera);
      three.animationFrame = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const activeThree = threeRef.current;
      if (!activeThree) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const depth = Math.max(320, Math.min(width, height) * 0.62);
      balloonStateRef.current.tankDepth = depth;

      canvasSizeRef.current = { width, height };
      onResize(width, height);

      activeThree.camera.aspect = width / height;
      activeThree.camera.updateProjectionMatrix();
      activeThree.renderer.setSize(width, height);

      activeThree.leftWall = -width / 2;
      activeThree.rightWall = width / 2;
      activeThree.topWall = height / 2;
      activeThree.bottomWall = -height / 2;
      activeThree.backWall = -depth / 2;
      activeThree.frontWall = depth / 2;
      activeThree.floor.position.y = activeThree.bottomWall;
      activeThree.floor.geometry.dispose();
      activeThree.floor.geometry = new THREE.PlaneGeometry(width, depth);

      activeThree.scene.remove(activeThree.tank);
      activeThree.tank.geometry.dispose();
      if (Array.isArray(activeThree.tank.material)) {
        activeThree.tank.material.forEach((m) => m.dispose());
      } else {
        activeThree.tank.material.dispose();
      }

      const newEdges = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(width, height, depth)
      );
      const newTank = new THREE.LineSegments(
        newEdges,
        new THREE.LineBasicMaterial({
          color: THEME_PALETTES[themeModeRef.current].tank,
          transparent: true,
          opacity: 0.42,
        })
      );
      activeThree.scene.add(newTank);
      activeThree.tank = newTank;
    };

    // Run once immediately to initialise canvasSizeRef
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(three.animationFrame);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      threeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update scene colors when theme changes
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;

    const palette = THEME_PALETTES[themeMode];
    three.scene.background = new THREE.Color(palette.sceneBackground);
    three.scene.fog = new THREE.Fog(palette.fog, 300, 2300);
    three.floor.material.color.set(palette.floor);

    const tankMaterial = three.tank.material;
    if (Array.isArray(tankMaterial)) {
      tankMaterial.forEach((m) => {
        if ("color" in m) (m as THREE.MeshStandardMaterial).color.set(palette.tank);
      });
    } else if ("color" in tankMaterial) {
      (tankMaterial as THREE.MeshStandardMaterial).color.set(palette.tank);
    }
    three.driftParticles.material.color.set(palette.particle);
  }, [themeMode]);

  return { threeRef, canvasSizeRef };
}
