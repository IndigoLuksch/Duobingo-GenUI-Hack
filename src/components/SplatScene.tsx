"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import styles from "./SplatScene.module.css";

interface SplatSceneProps {
  splatUrl: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  spawnPosition?: [number, number, number];
  /** Apply OpenCV→OpenGL axis fix for Marble CDN splats. Auto-detected from URL when omitted. */
  opencvToOpengl?: boolean;
  /** Called once the splat mesh has loaded and the scene is ready to display. */
  onReady?: () => void;
}

const MOVE_SPEED = 4;

function isMarbleSplatUrl(url: string): boolean {
  return /marble\.worldlabs\.ai|worldlabs\.ai\//.test(url);
}

function applyMarbleCoordinateFix(splatMesh: THREE.Object3D): void {
  // Marble exports use OpenCV (+y down, +z forward). Three.js uses OpenGL (+y up).
  splatMesh.scale.set(1, -1, -1);
}

function positionCameraInScene(
  camera: THREE.PerspectiveCamera,
  splatMesh: THREE.Object3D,
  spawnPosition?: [number, number, number],
  marbleSplat = false
) {
  if (spawnPosition) {
    camera.position.set(...spawnPosition);
    camera.lookAt(0, 1, 0);
    return;
  }

  const box = new THREE.Box3().setFromObject(splatMesh);
  if (box.isEmpty()) {
    camera.position.set(0, 1.6, 0);
    return;
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const floorY = box.min.y;

  // Marble bbox often includes distant sky/ceiling splats, so use a low capped offset.
  const eyeHeight = marbleSplat
    ? THREE.MathUtils.clamp(size.y * 0.03, 0.08, 0.85)
    : THREE.MathUtils.clamp(size.y * 0.08, 0.25, 1.65);

  const eyeY = floorY + eyeHeight;
  camera.position.set(center.x, eyeY, center.z);
  camera.lookAt(center.x, eyeY, center.z - 1);
}

export default function SplatScene({
  splatUrl,
  canvasRef,
  spawnPosition,
  opencvToOpengl = isMarbleSplatUrl(splatUrl),
  onReady,
}: SplatSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const [sceneReady, setSceneReady] = useState(false);
  const [showControlsHint, setShowControlsHint] = useState(true);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    setSceneReady(false);
  }, [splatUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.cursor = "crosshair";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const sparkRenderer = new SparkRenderer({ renderer });
    scene.add(sparkRenderer);

    const controls = new PointerLockControls(camera, canvas);
    scene.add(controls.object);

    const keys = { w: false, a: false, s: false, d: false, up: false, down: false };
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const splatMesh = new SplatMesh({ url: splatUrl });
    scene.add(splatMesh);

    const fallbackCube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x6366f1 })
    );
    fallbackCube.position.set(0, 1, 0);
    fallbackCube.visible = false;
    scene.add(fallbackCube);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(4, 8, 2);
    scene.add(ambient, directional);

    void splatMesh.initialized
      .then(() => {
        if (disposed) return;
        if (opencvToOpengl) {
          applyMarbleCoordinateFix(splatMesh);
        }
        positionCameraInScene(
          camera,
          splatMesh,
          spawnPosition,
          opencvToOpengl
        );
        if (canvasRef) {
          (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current =
            canvas;
        }
        setSceneReady(true);
        onReadyRef.current?.();
      })
      .catch(() => {
        if (!disposed) {
          fallbackCube.visible = true;
          positionCameraInScene(camera, fallbackCube, spawnPosition, false);
        }
      });

    const onLock = () => setShowControlsHint(false);
    const onUnlock = () => setShowControlsHint(true);
    controls.addEventListener("lock", onLock);
    controls.addEventListener("unlock", onUnlock);

    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
          keys.w = true;
          break;
        case "KeyA":
          keys.a = true;
          break;
        case "KeyS":
          keys.s = true;
          break;
        case "KeyD":
          keys.d = true;
          break;
        case "Space":
          keys.up = true;
          event.preventDefault();
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keys.down = true;
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
          keys.w = false;
          break;
        case "KeyA":
          keys.a = false;
          break;
        case "KeyS":
          keys.s = false;
          break;
        case "KeyD":
          keys.d = false;
          break;
        case "Space":
          keys.up = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keys.down = false;
          break;
      }
    };

    const onCanvasClick = () => {
      if (!controls.isLocked) {
        void controls.lock();
      }
    };

    const onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const updateMovement = (delta: number) => {
      if (!controls.isLocked) return;

      const distance = MOVE_SPEED * delta;
      if (keys.w) controls.moveForward(distance);
      if (keys.s) controls.moveForward(-distance);
      if (keys.a) controls.moveRight(-distance);
      if (keys.d) controls.moveRight(distance);
      if (keys.up) camera.position.y += distance;
      if (keys.down) camera.position.y -= distance;
    };

    const animate = () => {
      if (disposed) return;
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      updateMovement(delta);
      sparkRenderer.render(scene, camera);
      renderer.render(scene, camera);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);
    container.addEventListener("click", onCanvasClick);

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("click", onCanvasClick);
      controls.removeEventListener("lock", onLock);
      controls.removeEventListener("unlock", onUnlock);
      controls.dispose();

      scene.remove(splatMesh);
      scene.remove(fallbackCube);
      scene.remove(sparkRenderer);
      scene.remove(controls.object);

      splatMesh.dispose();
      sparkRenderer.dispose();
      fallbackCube.geometry.dispose();
      (fallbackCube.material as THREE.Material).dispose();
      renderer.dispose();

      if (canvasRef?.current === canvas) {
        (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current =
          null;
      }

      container.removeChild(canvas);
    };
  }, [canvasRef, splatUrl, spawnPosition, opencvToOpengl]);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
        }}
      />
      {sceneReady && (
        <div className={styles.controlsPanel} aria-label="Keyboard controls">
          <p className={styles.controlsTitle}>Controls</p>
          <ul className={styles.controlsList}>
            <li>
              <span className={styles.keyGroup}>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
              </span>
              <span className={styles.controlAction}>Move</span>
            </li>
            <li>
              <kbd>Mouse</kbd>
              <span className={styles.controlAction}>Look around</span>
            </li>
            <li>
              <kbd>Space</kbd>
              <span className={styles.controlAction}>Up</span>
            </li>
            <li>
              <kbd>Shift</kbd>
              <span className={styles.controlAction}>Down</span>
            </li>
            <li>
              <kbd>Esc</kbd>
              <span className={styles.controlAction}>Release mouse</span>
            </li>
          </ul>
          {showControlsHint && (
            <p className={styles.controlsNote}>Click the scene to start</p>
          )}
        </div>
      )}
    </>
  );
}
