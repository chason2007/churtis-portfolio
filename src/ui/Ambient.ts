/**
 * Ambient drone.
 *
 * Synthesised with the Web Audio API rather than streamed from a file: no
 * asset to download, no licence to worry about, no paid service, and it loops
 * forever without a seam. The whole thing is a handful of oscillators and one
 * filtered noise bed, which costs a fraction of a percent of CPU.
 *
 * OFF by default, always. The AudioContext is not even constructed until the
 * visitor asks for sound — browsers block autoplay precisely because sites do
 * otherwise, and a portfolio that makes noise unprompted is a portfolio people
 * close. The preference is deliberately not persisted: playback legally
 * requires a user gesture on every page load anyway, so a remembered "on"
 * would only produce a toggle that lies about its state.
 */

/** Peak master gain. Low: this should sit under everything, not in front. */
const LEVEL = 0.12;
const FADE_IN = 2.6;
const FADE_OUT = 1.1;

/** The drone's root, in Hz. A low A, plus a detuned partner for slow beating. */
const ROOT = 55;
const DETUNE = 0.31;

export type AmbientListener = (playing: boolean) => void;

export class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources: Array<OscillatorNode | AudioBufferSourceNode> = [];
  private listeners = new Set<AmbientListener>();

  private playing = false;
  private suspendedByVisibility = false;

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibilityChange, { passive: true });
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  on(fn: AmbientListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Start or stop. Must be called from a user gesture the first time. */
  async toggle(): Promise<boolean> {
    if (this.playing) {
      this.stop();
      return false;
    }

    try {
      await this.start();
    } catch (error) {
      console.warn('[ambient] could not start audio', error);
      this.playing = false;
    }

    this.emit();
    return this.playing;
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.teardown();
    this.listeners.clear();
    void this.ctx?.close();
    this.ctx = null;
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.playing);
  }

  private async start(): Promise<void> {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio is unavailable');

    this.ctx = this.ctx ?? new Ctx();
    // Autoplay policy: a context created outside a gesture starts suspended.
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.build(this.ctx);
    this.playing = true;
  }

  private build(ctx: AudioContext): void {
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(LEVEL, now + FADE_IN);
    master.connect(ctx.destination);
    this.master = master;

    // A gentle tremolo rides on the bus so the drone breathes instead of
    // sitting perfectly still, which is what makes a synth pad sound synthetic.
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.78, now);
    bus.connect(master);

    const tremolo = ctx.createOscillator();
    tremolo.frequency.value = 0.09;
    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = 0.22;
    tremolo.connect(tremoloDepth).connect(bus.gain);
    tremolo.start();
    this.sources.push(tremolo);

    // Everything but the air bed runs through one lowpass, swept very slowly.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    filter.Q.value = 0.8;
    filter.connect(bus);

    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.045;
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = 90;
    sweep.connect(sweepDepth).connect(filter.frequency);
    sweep.start();
    this.sources.push(sweep);

    // Root, a detuned twin (the beating between them is the whole character),
    // and a quiet fifth an octave up for a bit of lift.
    const voices: Array<[OscillatorType, number, number]> = [
      ['sine', ROOT, 0.5],
      ['sine', ROOT + DETUNE, 0.42],
      ['triangle', ROOT * 3, 0.07],
    ];

    for (const [type, frequency, gain] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;

      const level = ctx.createGain();
      level.gain.value = gain;

      osc.connect(level).connect(filter);
      osc.start();
      this.sources.push(osc);
    }

    // Air: a bandpassed noise bed, barely audible, that keeps the top end alive.
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx);
    noise.loop = true;

    const air = ctx.createBiquadFilter();
    air.type = 'bandpass';
    air.frequency.value = 1100;
    air.Q.value = 0.5;

    const airLevel = ctx.createGain();
    airLevel.gain.value = 0.02;

    noise.connect(air).connect(airLevel).connect(bus);
    noise.start();
    this.sources.push(noise);
  }

  private stop(): void {
    this.playing = false;
    this.fadeOutAndTeardown();
    this.emit();
  }

  private fadeOutAndTeardown(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    // setValueAtTime first, or the ramp starts from whatever the automation
    // curve last wrote rather than from the level you can currently hear.
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + FADE_OUT);

    const sources = this.sources;
    this.sources = [];
    this.master = null;

    window.setTimeout(() => {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
        source.disconnect();
      }
      master.disconnect();
    }, (FADE_OUT + 0.1) * 1000);
  }

  private teardown(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
    }
    this.sources = [];
    this.master?.disconnect();
    this.master = null;
    this.playing = false;
  }

  /**
   * Silence while the tab is hidden. Suspending the context rather than just
   * muting also stops the audio thread, which matters on battery.
   */
  private onVisibilityChange = (): void => {
    if (!this.ctx) return;

    if (document.hidden && this.playing) {
      this.suspendedByVisibility = true;
      void this.ctx.suspend();
    } else if (!document.hidden && this.suspendedByVisibility) {
      this.suspendedByVisibility = false;
      void this.ctx.resume();
    }
  };
}

/** Two seconds of white noise, looped. Longer than the ear can hear repeat. */
function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}
