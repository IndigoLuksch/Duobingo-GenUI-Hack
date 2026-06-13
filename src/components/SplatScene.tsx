"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

interface SplatSceneProps {
  splatUrl: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  spawnPosition?: [number, number, number];
}

const MOVE_SPEED = 4;

export default function SplatScene({
  splatUrl,
  canvasRef,
  spawnPosition = [0, 1.6, 3],
}: SplatSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    if (canvasRef) {
      (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current =
        canvas;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(...spawnPosition);
    camera.lookAt(0, 1, 0);

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

    const keys = { w: false, a: false, s: false, d: false };
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

    splatMesh.initialized.catch(() => {
      if (!disposed) {
        fallbackCube.visible = true;
      }
    });

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
      }
    };

    const onCanvasClick = () => {
      if (!controls.isLocked) {
        controls.lock();
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
    canvas.addEventListener("click", onCanvasClick);

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("click", onCanvasClick);
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

      if (canvasRef) {
        (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current =
          null;
      }

      container.removeChild(canvas);
    };
  }, [canvasRef, splatUrl, spawnPosition]);

  return (
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
  );
}
