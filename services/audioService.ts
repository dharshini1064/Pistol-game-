
import { DiscType } from '../types';

class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playShoot() {
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playHit(type: DiscType, combo: number = 1, precision: number = 1) {
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;
    
    const isBullseye = precision > 0.9;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    const now = this.ctx.currentTime;
    let duration = 0.15;

    switch (type) {
      case 'FAST':
        osc.type = 'square';
        osc.frequency.setValueAtTime(1000 + (combo * 50), now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
        duration = 0.1;
        break;
      case 'PULSATOR':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440 + (combo * 20), now);
        // Frequency wobble
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 20;
        lfoGain.gain.value = 100;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();
        lfo.stop(now + 0.3);
        duration = 0.3;
        break;
      case 'SHIELD':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1600, now);
        osc2.connect(gain);
        osc2.start();
        osc2.stop(now + 0.1);
        duration = 0.2;
        break;
      case 'SWARM':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        duration = 0.05;
        break;
      case 'BOMB':
        this.playExplosion();
        return;
      default:
        osc.type = isBullseye ? 'square' : 'sine';
        const baseFreq = isBullseye ? 880 : 440;
        osc.frequency.setValueAtTime(baseFreq + (combo * 20), now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.15);
    }

    gain.gain.setValueAtTime(isBullseye ? 0.2 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + duration);
  }

  playMiss() {
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.25);
    
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playExplosion() {
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;
    
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 1, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
    noise.stop(this.ctx.currentTime + 1);
  }
}

export const audioService = new AudioService();
