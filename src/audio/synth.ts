import { STEP } from './song.ts';

const PULSE_HARMONICS = 32;
const ECHO_STEPS = 3;

// Band-limited pulse wave from its Fourier series; duty 0.25 is the classic NES lead.
function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const real = new Float32Array(PULSE_HARMONICS);
  const imag = new Float32Array(PULSE_HARMONICS);
  for (let k = 1; k < PULSE_HARMONICS; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

function whiteNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export interface ToneOptions {
  wave?: PeriodicWave;
  type?: OscillatorType;
  f: number;
  t: number;
  dur: number;
  vol: number;
  slideTo?: number;
  release?: number;
}

export interface NoiseOptions {
  t: number;
  dur: number;
  vol: number;
  type?: BiquadFilterType;
  f?: number;
  q?: number;
}

export type Synth = ReturnType<typeof createSynth>;

/**
 * Mixer graph and two voices (tone, noise) on a fresh AudioContext.
 * master → compressor; music (lowpass) holds lead (+ echo), bass, arp and drums; sfx and ambience bypass the filter.
 */
export function createSynth() {
  const ctx = new AudioContext();
  const waves = { pulse25: pulseWave(ctx, 0.25), pulse50: pulseWave(ctx, 0.5) };
  const noiseBuffer = whiteNoise(ctx);

  const gain = (value: number, to?: AudioNode): GainNode => {
    const g = ctx.createGain();
    g.gain.value = value;
    if (to) g.connect(to);
    return g;
  };

  const compressor = ctx.createDynamicsCompressor();
  compressor.connect(ctx.destination);
  const master = gain(1, compressor);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 14000;
  filter.connect(master);
  const music = gain(0, filter);
  const lead = gain(1, music);
  // Short echo on the lead gives the chip sound some room.
  const echo = ctx.createDelay();
  echo.delayTime.value = STEP * ECHO_STEPS;
  echo.connect(gain(0.3, echo));
  echo.connect(gain(0.22, music));
  lead.connect(echo);

  const bus = {
    master,
    filter,
    music,
    lead,
    bass: gain(1, music),
    arp: gain(1, music),
    drums: gain(1, music),
    sfx: gain(0.9, master),
    ambience: gain(0.8, master),
  };

  return {
    ctx,
    bus,
    waves,

    tone(dest: AudioNode, { wave, type = 'square', f, t, dur, vol, slideTo, release = 0.04 }: ToneOptions): void {
      const osc = ctx.createOscillator();
      if (wave) osc.setPeriodicWave(wave);
      else osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(vol, t + 0.004);
      env.gain.linearRampToValueAtTime(vol * 0.7, t + dur);
      env.gain.linearRampToValueAtTime(0, t + dur + release);
      osc.connect(env).connect(dest);
      osc.start(t);
      osc.stop(t + dur + release + 0.02);
    },

    noise(dest: AudioNode, { t, dur, vol, type = 'highpass', f = 1000, q = 0.7 }: NoiseOptions): void {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const band = ctx.createBiquadFilter();
      band.type = type;
      band.frequency.value = f;
      band.Q.value = q;
      const env = ctx.createGain();
      env.gain.setValueAtTime(vol, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(band).connect(env).connect(dest);
      // Random offset so repeated hits don't sound identical.
      src.start(t, Math.random() * 0.8);
      src.stop(t + dur + 0.02);
    },
  };
}
