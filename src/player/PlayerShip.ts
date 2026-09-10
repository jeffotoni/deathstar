import { AbstractMesh, Color3, Constants, FresnelParameters, GlowLayer, Mesh, MeshBuilder, Quaternion, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { AssetManager } from '../core/AssetManager';
import { InputManager } from '../core/InputManager';
import { CONFIG } from '../config';
import { PlayerHealth } from './PlayerHealth';

export class PlayerShip {
  root: TransformNode;
  visual: TransformNode;
  health = new PlayerHealth();
  velocity = Vector3.Zero();
  speed = CONFIG.player.cruiseSpeed;
  throttle = CONFIG.player.cruiseSpeed;
  boost = 100;
  boosting = false;
  dodge = 0;
  dodgeCooldown = 0;
  shieldVisible = false;
  private dodgeSide = 1;
  private shield: Mesh;
  private shieldMaterial: StandardMaterial;
  private thrusters: AbstractMesh[] = [];
  private shieldAlpha = 0.008;
  private shieldFlash = 0;
  constructor(assets: AssetManager) {
    this.root = new TransformNode('player physics', assets.scene);
    this.root.rotationQuaternion = Quaternion.Identity();
    this.visual = assets.ship('player'); this.visual.parent = this.root;
    this.thrusters = this.visual.getChildMeshes().filter(mesh => mesh.name === 'thruster');
    this.shield = MeshBuilder.CreateSphere('player shield bubble', { diameter: 7, segments: 24 }, assets.scene);
    this.shield.parent = this.root; this.shield.scaling.set(1.15, 0.8, 1.25);
    const shieldMaterial = this.shieldMaterial = assets.material('player shield bubble', '#fff7dc', 4);
    this.shield.material = shieldMaterial;
    // Add light without darkening the ship. Fresnel follows the entire silhouette
    // from any viewing angle; the center remains almost completely transparent.
    shieldMaterial.disableLighting = true;
    shieldMaterial.diffuseColor = Color3.Black(); shieldMaterial.specularColor = Color3.Black();
    shieldMaterial.alphaMode = Constants.ALPHA_ADD;
    shieldMaterial.alpha = this.shieldAlpha; shieldMaterial.backFaceCulling = true; shieldMaterial.forceDepthWrite = false;
    shieldMaterial.opacityFresnelParameters = new FresnelParameters({
      leftColor: new Color3(1, 1, 1), rightColor: Color3.Black(), power: 0.18,
    });
    this.shield.isPickable = false;
    // Preserve the Fresnel silhouette in bloom instead of glowing as a solid disk.
    for (const layer of assets.scene.effectLayers ?? []) if (layer instanceof GlowLayer) {
      layer.referenceMeshToUseItsOwnMaterial(this.shield);
      this.shield.onDisposeObservable.addOnce(() => layer.unReferenceMeshFromUsingItsOwnMaterial(this.shield));
    }
    this.shield.setEnabled(false);
  }
  get position() { return this.root.position; }
  get forward() { return this.root.getDirection(Vector3.Forward()).normalize(); }
  get right() { return this.root.getDirection(Vector3.Right()).normalize(); }
  get up() { return this.root.getDirection(Vector3.Up()).normalize(); }
  toggleShield() { this.shieldVisible = !this.shieldVisible; this.shield.setEnabled(this.shieldVisible); return this.shieldVisible; }
  shieldImpact() { this.shieldFlash = Math.max(this.shieldFlash, 0.28); }
  update(dt: number, input: InputManager) {
    const deadzone = (v: number) => Math.abs(v) < 0.065 ? 0 : Math.sign(v) * (Math.abs(v) - 0.065) / 0.935;
    const yaw = deadzone(input.mouseX);
    const pitch = deadzone(input.mouseY);
    const roll = Number(input.down('KeyA')) - Number(input.down('KeyD'));
    const turn = CONFIG.player.turnRate * (this.boosting ? 0.64 : 1);
    const delta = Quaternion.RotationYawPitchRoll(yaw * turn * dt, pitch * turn * dt, roll * dt * 1.8);
    this.root.rotationQuaternion = this.root.rotationQuaternion!.multiply(delta).normalize();
    this.throttle = Math.max(CONFIG.player.minSpeed, Math.min(CONFIG.player.maxSpeed, this.throttle + (Number(input.down('KeyW')) - Number(input.down('KeyS'))) * dt * 65));
    this.boosting = input.down('ShiftLeft') && this.boost > 1;
    this.boost = Math.max(0, Math.min(100, this.boost + dt * (this.boosting ? -23 : 14)));
    this.speed += ((this.boosting ? CONFIG.player.boostSpeed : this.throttle) - this.speed) * (1 - Math.exp(-dt * 2.4));
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    if (input.consume('Space') && this.dodgeCooldown === 0) { this.dodge = 0.65; this.dodgeCooldown = 3; this.dodgeSide = input.mouseX < 0 ? -1 : 1; }
    this.dodge = Math.max(0, this.dodge - dt);
    const strafe = Number(input.down('KeyE')) - Number(input.down('KeyQ'));
    const desired = this.forward.scale(this.speed).add(this.right.scale(strafe * 32 + (this.dodge > 0 ? this.dodgeSide * 105 : 0)));
    this.velocity = Vector3.Lerp(this.velocity, desired, 1 - Math.exp(-dt * 5));
    this.position.addInPlace(this.velocity.scale(dt));
    const bank = -yaw * 0.5;
    this.visual.rotation.z += (bank - this.visual.rotation.z) * (1 - Math.exp(-dt * 6));
    if (this.dodge > 0) this.visual.rotation.z = this.dodgeSide * (1 - this.dodge / 0.65) * Math.PI * 2;
    for (const mesh of this.thrusters) mesh.scaling.y = (this.boosting ? 2.7 : 0.7 + this.speed / 130) + Math.random() * 0.12;
    this.shieldFlash = Math.max(0, this.shieldFlash - dt);
    if (this.shieldVisible) this.shieldMaterial.alpha = this.shieldAlpha + this.shieldFlash * 0.24;
    this.health.update(dt);
  }
}
