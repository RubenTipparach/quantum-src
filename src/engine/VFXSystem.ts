import * as THREE from 'three';

export type VFXEvent = 'buy' | 'sell' | 'getStocks' | 'print' | 'error' | 'run' | 'done';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class VFXSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private cpuMesh: THREE.Mesh;
  private cpuGlow: THREE.PointLight;
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // CPU chip
    const cpuGeometry = new THREE.BoxGeometry(2, 0.3, 2);
    const cpuMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aa55,
      emissive: 0x002211,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.cpuMesh = new THREE.Mesh(cpuGeometry, cpuMaterial);
    this.cpuMesh.position.y = 0.15;
    scene.add(this.cpuMesh);

    // Glow light under CPU
    this.cpuGlow = new THREE.PointLight(0x00ff88, 0, 5);
    this.cpuGlow.position.set(0, 0.5, 0);
    scene.add(this.cpuGlow);
  }

  trigger(event: VFXEvent): void {
    switch (event) {
      case 'run':
        this.cpuPulse(0x00ff88);
        this.spawnBurst(0x00ff88, 8, 0.3);
        break;
      case 'done':
        this.cpuPulse(0x004422);
        break;
      case 'buy':
        this.spawnStream(0x00ffaa, new THREE.Vector3(-2, 0.5, 0), new THREE.Vector3(0, 0.5, 0), 6);
        this.cpuPulse(0x00ffaa);
        break;
      case 'sell':
        this.spawnStream(0x00ffaa, new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(2, 0.5, 0), 6);
        this.cpuPulse(0xffaa00);
        break;
      case 'getStocks':
        this.spawnRing(0x4488ff, 1.5);
        break;
      case 'print':
        this.spawnBurst(0x88ccaa, 3, 0.15);
        break;
      case 'error':
        this.spawnBurst(0xff3333, 12, 0.5);
        this.cpuPulse(0xff3333);
        break;
    }
  }

  private cpuPulse(color: number): void {
    const mat = this.cpuMesh.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(color);
    mat.emissiveIntensity = 2;
    this.cpuGlow.color.setHex(color);
    this.cpuGlow.intensity = 3;
  }

  private spawnBurst(color: number, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        0.5 + Math.random() * 0.5,
        Math.sin(angle) * speed,
      );
      this.spawnParticle(new THREE.Vector3(0, 0.5, 0), vel, color, 1.0);
    }
  }

  private spawnStream(color: number, from: THREE.Vector3, to: THREE.Vector3, count: number): void {
    const dir = to.clone().sub(from).normalize();
    for (let i = 0; i < count; i++) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        Math.random() * 0.3,
        (Math.random() - 0.5) * 0.3,
      );
      const vel = dir.clone().multiplyScalar(1.5 + Math.random()).add(offset);
      const startPos = from.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        0,
        (Math.random() - 0.5) * 0.5,
      ));
      this.spawnParticle(startPos, vel, color, 0.8 + Math.random() * 0.4);
    }
  }

  private spawnRing(color: number, radius: number): void {
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const pos = new THREE.Vector3(
        Math.cos(angle) * radius,
        0.5,
        Math.sin(angle) * radius,
      );
      const vel = new THREE.Vector3(
        Math.cos(angle) * 0.3,
        0.2 + Math.random() * 0.2,
        Math.sin(angle) * 0.3,
      );
      this.spawnParticle(pos, vel, color, 0.6);
    }
  }

  private spawnParticle(position: THREE.Vector3, velocity: THREE.Vector3, color: number, life: number): void {
    const size = 0.06 + Math.random() * 0.06;
    const geometry = new THREE.SphereGeometry(size, 4, 4);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.particles.push({ mesh, velocity, life, maxLife: life });
  }

  update(delta: number): void {
    this.time += delta;

    // CPU idle breathing
    const mat = this.cpuMesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = Math.max(0.3, mat.emissiveIntensity - delta * 2);
    mat.emissive.lerp(new THREE.Color(0x002211), delta * 3);
    this.cpuGlow.intensity = Math.max(0, this.cpuGlow.intensity - delta * 4);

    // Gentle CPU rotation
    this.cpuMesh.rotation.y = Math.sin(this.time * 0.5) * 0.1;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= delta;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.velocity.y -= delta * 2; // gravity
      p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));

      // Fade out
      const t = p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = t;
      p.mesh.scale.setScalar(t);
    }
  }
}
