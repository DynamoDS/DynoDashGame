/**
 * Procedural chiptune sound engine — no audio files required.
 * All sounds are synthesised with the Web Audio API.
 *
 * Usage: import { soundEngine } from "./SoundEngine";
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicTimeout: ReturnType<typeof setTimeout> | null = null;
  private wireSlideOsc: OscillatorNode | null = null;
  private wireSlideLfo: OscillatorNode | null = null;
  private wireSlideGain: GainNode | null = null;

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /** Call once after any user gesture so the AudioContext is allowed to run. */
  resume(): void {
    void this.ac.resume();
  }

  // ─── One-shot SFX ───────────────────────────────────────────────────────────

  /** Rising chirp — Mario-style jump. */
  playJump(): void {
    const ctx = this.ac;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.09);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  /** Two-tone ding — coin / node-block collect. */
  playCoin(): void {
    const ctx = this.ac;
    const t = ctx.currentTime;
    for (const [freq, delay, dur] of [
      [988, 0, 0.08],
      [1319, 0.07, 0.14],
    ] as [number, number, number][]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, t + delay);
      gain.gain.setValueAtTime(0.18, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      osc.start(t + delay);
      osc.stop(t + delay + dur);
    }
  }

  /** Soft low thump — landing on a platform. */
  playLand(): void {
    const ctx = this.ac;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.07);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /** Descending chromatic run — player death. */
  playDeath(): void {
    const ctx = this.ac;
    const notes = [523, 494, 466, 440, 415, 392, 370, 349];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      const t = ctx.currentTime + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  // ─── Wire-slide continuous tone ─────────────────────────────────────────────

  /**
   * Start a continuous wire-slide sound: a sawtooth buzz at ~400 Hz with an
   * LFO vibrating the pitch ±30 Hz at 8 Hz, giving the feel of a taut wire
   * singing under the player's weight.  Idempotent — safe to call every frame.
   */
  startWireSlide(): void {
    if (this.wireSlideOsc) return; // already playing
    const ctx = this.ac;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 8;
    lfoGain.gain.value = 30; // ±30 Hz pitch flutter
    lfo.connect(lfoGain);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 400;
    lfoGain.connect(osc.frequency);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.06); // short fade-in
    osc.connect(gain);
    gain.connect(ctx.destination);

    lfo.start();
    osc.start();

    this.wireSlideOsc = osc;
    this.wireSlideLfo = lfo;
    this.wireSlideGain = gain;
  }

  /** Fade out and stop the wire-slide tone. */
  stopWireSlide(): void {
    const ctx = this.ac;
    const t = ctx.currentTime;

    if (this.wireSlideGain) {
      this.wireSlideGain.gain.setValueAtTime(this.wireSlideGain.gain.value, t);
      this.wireSlideGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    }
    const osc = this.wireSlideOsc;
    const lfo = this.wireSlideLfo;
    if (osc) { osc.stop(t + 0.15); this.wireSlideOsc = null; }
    if (lfo) { lfo.stop(t + 0.15); this.wireSlideLfo = null; }
    this.wireSlideGain = null;
  }

  // ─── Background music ────────────────────────────────────────────────────────

  startMusic(): void {
    this.stopMusic();
    this._scheduleLoop();
  }

  stopMusic(): void {
    if (this.musicTimeout !== null) {
      clearTimeout(this.musicTimeout);
      this.musicTimeout = null;
    }
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  /**
   * Schedule one pass of the background loop then queue the next.
   * Retries if the AudioContext is still suspended (autoplay policy).
   *
   * Original Dyno Dash theme — A minor pentatonic ascending/descending run.
   * at 160 BPM (quarter = 0.375 s), total ≈ 6 s.
   */
  private _scheduleLoop(): void {
    const ctx = this.ac;
    if (ctx.state !== "running") {
      this.musicTimeout = setTimeout(() => {
        this.musicTimeout = null;
        this._scheduleLoop();
      }, 100);
      return;
    }

    const Q = 60 / 160; // 0.375 s per quarter note at 160 BPM
    const E = Q / 2;    // eighth note
    const H = Q * 2;    // half note
    const melody: [number, number][] = [
      [440.00, Q],  // A4
      [523.25, Q],  // C5
      [659.25, Q],  // E5
      [783.99, Q],  // G5
      [659.25, E],  // E5 (eighth)
      [523.25, E],  // C5 (eighth)
      [440.00, Q],  // A4
      [392.00, H],  // G4 (half)
      [329.63, Q],  // E4
      [392.00, Q],  // G4
      [440.00, Q],  // A4
      [587.33, Q],  // D5
      [659.25, E],  // E5 (eighth)
      [587.33, E],  // D5 (eighth)
      [523.25, Q],  // C5
      [0,      H],  // rest (half)
    ];

    // Master gain keeps music quieter than SFX
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.09, ctx.currentTime);
    master.connect(ctx.destination);

    let offset = 0;
    const t = ctx.currentTime;
    for (const [freq, dur] of melody) {
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const ng = ctx.createGain();
        osc.connect(ng);
        ng.connect(master);
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, t + offset);
        ng.gain.setValueAtTime(1, t + offset);
        ng.gain.exponentialRampToValueAtTime(0.001, t + offset + dur * 0.85);
        osc.start(t + offset);
        osc.stop(t + offset + dur);
      }
      offset += dur;
    }

    // Queue the next iteration slightly before this one ends to avoid gaps
    this.musicTimeout = setTimeout(() => {
      this.musicTimeout = null;
      this._scheduleLoop();
    }, (offset - 0.05) * 1000);
  }

  private get ac(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }
}

export const soundEngine = new SoundEngine();
