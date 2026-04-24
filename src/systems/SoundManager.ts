/**
 * SoundManager — Procedural sound effects using Phaser's Web Audio API.
 * No external audio files required. All sounds are synthesized at runtime.
 */
export class SoundManager {
  private scene: Phaser.Scene;
  private ctx: AudioContext | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Lazily obtain the AudioContext from Phaser's sound manager. */
  private getCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    // Phaser stores the Web Audio context internally
    const manager = this.scene.sound as unknown as { context?: AudioContext };
    if (manager && manager.context instanceof AudioContext) {
      this.ctx = manager.context;
    }
    return this.ctx;
  }

  // ─── Public API ──────────────────────────────────────────────────

  /** Play a sword-swing sound (short noise burst with frequency sweep). */
  playAttack(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // White noise burst shaped by a band-pass filter
    const duration = 0.12;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // fade out
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // High-pass filter for a "swoosh" feel
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(2000, now);
    hp.frequency.linearRampToValueAtTime(4000, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    noise.connect(hp).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

  /** Play a short "pop" sound for enemy death. */
  playEnemyDeath(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Play a bright ascending arpeggio for item pickup. */
  playPickup(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + i * 0.06);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.06 + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.06 + 0.1);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.12);
    });
  }

  /** Play a descending tone for player hurt. */
  playHurt(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.25);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.25);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /** Play a "click + rising" sound for opening a chest. */
  playChestOpen(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Click component
    const click = ctx.createOscillator();
    click.type = "square";
    click.frequency.setValueAtTime(800, now);
    click.frequency.setValueAtTime(600, now + 0.03);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.25, now);
    clickGain.gain.linearRampToValueAtTime(0, now + 0.08);

    click.connect(clickGain).connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.08);

    // Rising arpeggio component
    const riseNotes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
    riseNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + 0.06 + i * 0.07);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + 0.06 + i * 0.07);
      g.gain.linearRampToValueAtTime(0.18, now + 0.06 + i * 0.07 + 0.01);
      g.gain.linearRampToValueAtTime(0, now + 0.06 + i * 0.07 + 0.15);

      osc.connect(g).connect(ctx.destination);
      osc.start(now + 0.06 + i * 0.07);
      osc.stop(now + 0.06 + i * 0.07 + 0.18);
    });
  }
}
