export class AudioEngine {
  ctx: AudioContext | null = null;
  isMuted: boolean = false;
  isPlaying: boolean = false;
  
  // Sequencer State
  private nextNoteTime: number = 0;
  private tempo: number = 100; // Base BPM
  private timerID: number | null = null;
  private rhythmIndex: number = 0;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopMusic();
    } else {
      if (this.isPlaying) this.startMusic();
    }
    return this.isMuted;
  }

  playExplosion() {
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Noise Burst
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(50, t + 0.4);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start();

    // Sub-bass Impact
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.4);
    
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.8, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 0.5);
  }

  playScore() {
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, t); // Lower volume to not distract from music
    gain.gain.linearRampToValueAtTime(0, t + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 0.1);
  }

  startMusic() {
    if (this.isPlaying) return;
    this.init();
    
    this.isPlaying = true;
    this.rhythmIndex = 0;
    
    if (this.ctx) {
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.scheduler();
    }
  }

  setIntensity(speedMultiplier: number) {
    // Base tempo is 100.
    // As game speeds up (multiplier > 1), tempo increases.
    // We clamp minimum to avoid stalling, but allow high max.
    const targetTempo = 100 * Math.max(1, speedMultiplier);
    // Smooth transition
    this.tempo += (targetTempo - this.tempo) * 0.1;
  }

  stopMusic() {
    this.isPlaying = false;
    if (this.timerID !== null) {
        clearTimeout(this.timerID);
        this.timerID = null;
    }
  }

  // --- INTERNAL SEQUENCER ---
  private scheduler() {
      if (!this.isPlaying || !this.ctx || this.isMuted) return;

      // Lookahead 100ms
      while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
          this.scheduleNote(this.nextNoteTime);
          
          // Calculate time to next 16th note
          const secondsPerBeat = 60.0 / this.tempo;
          const secondsPer16th = secondsPerBeat * 0.25; 
          
          this.nextNoteTime += secondsPer16th;
          this.rhythmIndex++;
      }
      this.timerID = window.setTimeout(this.scheduler.bind(this), 25);
  }

  private scheduleNote(time: number) {
      if (!this.ctx) return;

      const step = this.rhythmIndex % 16; // 16 step loop

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      // KICK: Steps 0, 4, 8, 12 (Quarter notes)
      if (step % 4 === 0) {
          osc.frequency.setValueAtTime(150, time);
          osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
          gain.gain.setValueAtTime(0.7, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
          osc.start(time);
          osc.stop(time + 0.5);
      } 
      
      // BASS OFFBEAT: Steps 2, 6, 10, 14
      if (step % 4 === 2) {
           osc.type = 'sawtooth';
           // Bass pitch follows a simple progression every 16 steps
           const root = (Math.floor(this.rhythmIndex / 16) % 2 === 0) ? 60 : 50; 
           
           osc.frequency.setValueAtTime(root, time);
           osc.frequency.exponentialRampToValueAtTime(root/2, time + 0.2);
           
           // Low pass filter effect simulation by gain shaping
           gain.gain.setValueAtTime(0.15, time);
           gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
           
           osc.start(time);
           osc.stop(time + 0.2);
      }

      // HI-HAT: Every odd step (1, 3, 5...)
      if (step % 2 !== 0) {
          osc.type = 'square'; // Noisy texture
          // Randomized slightly for natural feel
          osc.frequency.setValueAtTime(2000 + Math.random() * 500, time);
          
          gain.gain.setValueAtTime(0.03, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
          
          osc.start(time);
          osc.stop(time + 0.05);
      }
  }
}