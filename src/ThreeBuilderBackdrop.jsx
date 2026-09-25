import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function buildFlowCurve(start, bend, end) {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(start[0], start[1], start[2]),
    new THREE.Vector3(bend[0], bend[1], bend[2]),
    new THREE.Vector3(end[0], end[1], end[2]),
  ]);
}

const FLOW_CURVES = [
  buildFlowCurve([-5.2, 1.4, -0.4], [-1.8, 0.6, 0.2], [3.6, 1.8, 0.6]),
  buildFlowCurve([-4.4, -1.7, -0.2], [-0.6, -0.8, 0.35], [4.8, -1.2, -0.1]),
  buildFlowCurve([-3.2, 0.1, -0.3], [0.8, 0.95, 0.4], [5.3, -0.1, 0.2]),
];

export default function ThreeBuilderBackdrop({ accent = '#00C9A7' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, 13);
    camera.lookAt(0, 0, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);
    } catch {
      return undefined;
    }

    const root = new THREE.Group();
    scene.add(root);

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    const mintLight = new THREE.PointLight(new THREE.Color(accent), 5, 24, 2);
    mintLight.position.set(-3, 3.2, 5.5);
    const violetLight = new THREE.PointLight(0xa855f7, 4.2, 26, 2);
    violetLight.position.set(3.8, -2.6, 4.6);
    scene.add(ambient, mintLight, violetLight);

    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 150;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      particlePositions[index * 3] = (Math.random() - 0.5) * 14;
      particlePositions[index * 3 + 1] = (Math.random() - 0.5) * 7;
      particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 3;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
        size: 0.04,
      }),
    );
    root.add(particles);

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xb59ae8,
      transparent: true,
      opacity: 0.25,
    });

    const lines = FLOW_CURVES.map((curve) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(90));
      const line = new THREE.Line(geometry, lineMaterial.clone());
      root.add(line);
      return line;
    });

    const nodeGeometry = new THREE.SphereGeometry(0.14, 20, 20);
    const nodes = [
      { position: [-4.8, 1.2, 0.1], scale: 1.25 },
      { position: [-2.4, -1.5, -0.1], scale: 0.85 },
      { position: [0.1, 0.4, 0.2], scale: 1.55 },
      { position: [2.5, 1.45, 0.35], scale: 1 },
      { position: [4.6, -1.1, 0], scale: 0.9 },
    ].map((item) => {
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(accent),
        emissive: new THREE.Color(accent).multiplyScalar(0.6),
        emissiveIntensity: 0.85,
        roughness: 0.28,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
      });
      const mesh = new THREE.Mesh(nodeGeometry, material);
      mesh.position.set(...item.position);
      mesh.scale.setScalar(item.scale);
      root.add(mesh);
      return { mesh, baseY: item.position[1] };
    });

    const pulseGeometry = new THREE.SphereGeometry(0.09, 18, 18);
    const pulses = FLOW_CURVES.map((curve, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
      });
      const mesh = new THREE.Mesh(pulseGeometry, material);
      mesh.userData.offset = index / FLOW_CURVES.length;
      root.add(mesh);
      return { mesh, curve };
    });

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      frameId = window.requestAnimationFrame(animate);

      root.rotation.y = Math.sin(elapsed * 0.08) * 0.12;
      root.rotation.x = Math.cos(elapsed * 0.06) * 0.05;
      particles.rotation.z = elapsed * 0.01;

      nodes.forEach(({ mesh, baseY }, index) => {
        mesh.position.y = baseY + Math.sin(elapsed * 0.6 + index * 1.2) * 0.08;
        mesh.material.emissiveIntensity = 0.7 + ((Math.sin(elapsed * 1.1 + index) + 1) * 0.18);
      });

      pulses.forEach(({ mesh, curve }, index) => {
        const t = (elapsed * 0.08 + mesh.userData.offset + index * 0.06) % 1;
        const point = curve.getPointAt(t);
        mesh.position.copy(point);
        mesh.scale.setScalar(0.9 + Math.sin(elapsed * 2 + index) * 0.08);
        mesh.material.opacity = 0.32 + ((Math.sin(elapsed * 1.8 + index) + 1) * 0.16);
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      particlesGeometry.dispose();
      nodeGeometry.dispose();
      pulseGeometry.dispose();
      lines.forEach((line) => {
        line.geometry.dispose();
        line.material.dispose();
      });
      nodes.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      pulses.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      scene.clear();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [accent]);

  return <div className="three-builder-backdrop" ref={containerRef} aria-hidden="true" />;
}
