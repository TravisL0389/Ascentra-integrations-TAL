import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ORBIT_CONFIGS = [
  { radiusX: 3.6, radiusY: 2.15, speed: 0.28, tiltX: 0.8, tiltZ: 0, color: 'rgba(226,232,240,0.2)' },
  { radiusX: 5.1, radiusY: 3.05, speed: 0.22, tiltX: 0.95, tiltZ: Math.PI / 3, color: 'rgba(196,181,253,0.22)' },
  { radiusX: 6.45, radiusY: 3.85, speed: 0.18, tiltX: 1.02, tiltZ: -Math.PI / 3, color: 'rgba(148,163,184,0.18)' },
];

function createOrbitLine({ radiusX, radiusY, color }) {
  const points = [];
  for (let step = 0; step <= 240; step += 1) {
    const t = (step / 240) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(t) * radiusX, Math.sin(t) * radiusY, 0));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.56,
  });
  return new THREE.LineLoop(geometry, material);
}

export default function ThreeOrbitalHero({ agents, onAgentClick }) {
  const containerRef = useRef(null);
  const chipRefs = useRef([]);
  const hoveredRef = useRef(null);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !agents?.length) return undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x090d16, 0.06);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0.6, 15.5);
    camera.lookAt(0, 0.2, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);
    } catch {
      return undefined;
    }

    const root = new THREE.Group();
    scene.add(root);

    const ambient = new THREE.AmbientLight(0xffffff, 1.65);
    const mintLight = new THREE.PointLight(0x3dd8b2, 18, 26, 2);
    mintLight.position.set(2.5, 2.5, 5.5);
    const violetLight = new THREE.PointLight(0x8b5cf6, 13, 26, 2);
    violetLight.position.set(-4.5, -2.25, 4.75);
    const rimLight = new THREE.PointLight(0xf472b6, 8, 24, 2);
    rimLight.position.set(0, 5.5, -6);
    scene.add(ambient, mintLight, violetLight, rimLight);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 360;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      starPositions[i * 3] = (Math.random() - 0.5) * 26;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0xdce7ff, size: 0.045, transparent: true, opacity: 0.55 })
    );
    scene.add(stars);

    const nucleusGroup = new THREE.Group();
    root.add(nucleusGroup);

    const glowGeometry = new THREE.SphereGeometry(1.7, 48, 48);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x3dd8b2,
      transparent: true,
      opacity: 0.1,
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.scale.set(1.5, 1.5, 1.5);
    nucleusGroup.add(glowMesh);

    const coreGeometry = new THREE.IcosahedronGeometry(1.06, 6);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x73f1de,
      emissive: 0x1cb69b,
      emissiveIntensity: 1.25,
      roughness: 0.18,
      metalness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    nucleusGroup.add(coreMesh);

    const protonGeometry = new THREE.SphereGeometry(0.3, 24, 24);
    const protonMaterial = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xde3d5d,
      emissiveIntensity: 0.9,
      roughness: 0.36,
      metalness: 0.05,
    });
    const neutronMaterial = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: 0x2563eb,
      emissiveIntensity: 0.75,
      roughness: 0.34,
      metalness: 0.08,
    });

    const nucleons = [
      { pos: [-0.45, 0.38, 0.28], material: protonMaterial },
      { pos: [0.42, 0.32, -0.22], material: neutronMaterial },
      { pos: [-0.36, -0.44, -0.18], material: neutronMaterial },
      { pos: [0.38, -0.28, 0.26], material: protonMaterial },
      { pos: [0.02, -0.04, 0.02], material: protonMaterial },
    ].map(({ pos, material }) => {
      const mesh = new THREE.Mesh(protonGeometry, material);
      mesh.position.set(...pos);
      nucleusGroup.add(mesh);
      return { mesh, base: new THREE.Vector3(...pos) };
    });

    const ringGroup = new THREE.Group();
    root.add(ringGroup);
    const rings = ORBIT_CONFIGS.map((config) => {
      const ring = createOrbitLine(config);
      ring.rotation.x = config.tiltX;
      ring.rotation.z = config.tiltZ;
      ringGroup.add(ring);
      return ring;
    });

    const satelliteGeometry = new THREE.SphereGeometry(0.36, 28, 28);
    const satellites = agents.map((agent, index) => {
      const color = new THREE.Color(agent.color);
      const material = new THREE.MeshPhysicalMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.7),
        emissiveIntensity: 0.88,
        roughness: 0.22,
        metalness: 0.18,
        clearcoat: 0.55,
        clearcoatRoughness: 0.14,
      });
      const mesh = new THREE.Mesh(satelliteGeometry, material);
      root.add(mesh);

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.54, 20, 20),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.14,
        })
      );
      mesh.add(halo);

      return {
        agent,
        mesh,
        material,
        config: ORBIT_CONFIGS[index % ORBIT_CONFIGS.length],
        phase: (index / agents.length) * Math.PI * 2,
      };
    });

    const clock = new THREE.Clock();
    const projected = new THREE.Vector3();
    const pointerPlane = new THREE.Vector2();

    const size = { width: 0, height: 0 };
    const resize = () => {
      size.width = container.clientWidth;
      size.height = container.clientHeight;
      if (!size.width || !size.height) return;
      camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix();
      renderer.setSize(size.width, size.height, false);
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const handlePointerMove = (event) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerTargetRef.current = {
        x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
      };
    };

    const handlePointerLeave = () => {
      pointerTargetRef.current = { x: 0, y: 0 };
    };

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', handlePointerLeave);

    let frameId = 0;
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      frameId = window.requestAnimationFrame(animate);

      pointerCurrentRef.current.x += (pointerTargetRef.current.x - pointerCurrentRef.current.x) * 0.045;
      pointerCurrentRef.current.y += (pointerTargetRef.current.y - pointerCurrentRef.current.y) * 0.045;
      pointerPlane.set(pointerCurrentRef.current.x, pointerCurrentRef.current.y);

      root.rotation.y = elapsed * 0.065 + pointerPlane.x * 0.16;
      root.rotation.x = Math.sin(elapsed * 0.12) * 0.035 - pointerPlane.y * 0.08;
      root.position.x = pointerPlane.x * 0.35;
      root.position.y = pointerPlane.y * -0.2;
      camera.position.x += ((pointerPlane.x * 0.65) - camera.position.x) * 0.03;
      camera.position.y += ((0.6 - pointerPlane.y * 0.35) - camera.position.y) * 0.03;
      camera.lookAt(root.position.x * 0.16, 0.2 + root.position.y * 0.1, 0);

      stars.rotation.y = elapsed * 0.01;
      stars.rotation.x = Math.sin(elapsed * 0.05) * 0.05;
      ringGroup.rotation.z = elapsed * 0.018;

      coreMesh.rotation.x = elapsed * 0.16;
      coreMesh.rotation.y = elapsed * 0.21;
      glowMesh.scale.setScalar(1.42 + Math.sin(elapsed * 0.95) * 0.06);
      glowMaterial.opacity = 0.08 + (Math.sin(elapsed * 1.1) + 1) * 0.024;

      nucleons.forEach(({ mesh, base }, index) => {
        const wobble = elapsed * 0.9 + index * 0.8;
        mesh.position.x = base.x + Math.sin(wobble) * 0.04;
        mesh.position.y = base.y + Math.cos(wobble * 1.15) * 0.04;
        mesh.position.z = base.z + Math.sin(wobble * 0.75) * 0.03;
      });

      satellites.forEach((satellite, index) => {
        const { mesh, config, phase, material } = satellite;
        const angle = elapsed * config.speed + phase;
        const ringX = Math.cos(angle) * config.radiusX;
        const ringY = Math.sin(angle) * config.radiusY;

        const local = new THREE.Vector3(ringX, ringY, 0);
        local.applyEuler(new THREE.Euler(config.tiltX, 0, config.tiltZ));
        mesh.position.copy(local);
        mesh.rotation.y = elapsed * 0.34 + index;
        mesh.position.z += Math.sin(elapsed * 0.8 + index) * 0.08;

        const hovered = hoveredRef.current === index;
        material.emissiveIntensity = hovered ? 1.28 : 0.84;
        mesh.scale.setScalar(hovered ? 1.16 : 0.98 + Math.sin(elapsed * 0.8 + index) * 0.02);

        const chip = chipRefs.current[index];
        if (chip && size.width && size.height) {
          projected.copy(mesh.position).project(camera);
          const x = (projected.x * 0.5 + 0.5) * size.width;
          const y = (-projected.y * 0.5 + 0.5) * size.height;
          const visible = projected.z > -1 && projected.z < 1;
          chip.style.opacity = visible ? `${THREE.MathUtils.clamp(1 - Math.max(projected.z, 0) * 0.7, 0.12, 1)}` : '0';
          chip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${hovered ? 1.08 : 1})`;
          chip.style.zIndex = `${Math.round((1 - projected.z) * 100)}`;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
      renderer.dispose();
      starGeometry.dispose();
      protonGeometry.dispose();
      glowGeometry.dispose();
      coreGeometry.dispose();
      satelliteGeometry.dispose();
      glowMaterial.dispose();
      coreMaterial.dispose();
      protonMaterial.dispose();
      neutronMaterial.dispose();
      satellites.forEach(({ mesh, material }) => {
        mesh.parent?.remove(mesh);
        mesh.geometry.dispose();
        material.dispose();
        mesh.children.forEach((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      });
      rings.forEach((ring) => {
        ring.geometry.dispose();
        ring.material.dispose();
      });
      scene.clear();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [agents]);

  return (
    <div className="three-orbital-hero">
      <div className="three-orbital-hero__canvas" ref={containerRef} />
      <div className="three-orbital-hero__overlay">
        {agents.map((agent, index) => (
          <button
            key={agent.id}
            type="button"
            ref={(node) => {
              chipRefs.current[index] = node;
            }}
            className="three-orbital-hero__chip"
            style={{ borderColor: `${agent.color}55`, boxShadow: `0 0 24px ${agent.glow || `${agent.color}44`}` }}
            onMouseEnter={() => {
              hoveredRef.current = index;
            }}
            onMouseLeave={() => {
              hoveredRef.current = null;
            }}
            onClick={() => onAgentClick(agent)}
            aria-label={agent.name}
          >
            <span
              className="three-orbital-hero__dot"
              style={{ background: `radial-gradient(circle at 30% 30%, #ffffff, ${agent.color})` }}
            />
            <span className="three-orbital-hero__label">{agent.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
