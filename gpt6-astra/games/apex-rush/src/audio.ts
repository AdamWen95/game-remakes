const lobbyNotes = [57, 0, 69, 72, 69, 0, 64, 67, 55, 0, 67, 71, 67, 0, 62, 64, 53, 0, 65, 69, 65, 0, 60, 62, 55, 0, 67, 71, 74, 71, 67, 0];
const lobbyBass = [45, 43, 41, 43];

export class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private noiseGain?: GainNode;
  private inLobby = true;
  private lobbyTimer?: ReturnType<typeof setInterval>;
  private lobbyStep = 0;
  muted = false;
  async unlock() {
    try {
      if (!this.ctx) {
        const ctx = new AudioContext(); this.ctx = ctx;
        const gain = ctx.createGain(); gain.gain.value = this.muted?0:0.18; gain.connect(ctx.destination); this.master = gain;
        const oscillator = ctx.createOscillator(); oscillator.type = 'sawtooth';
        const filter = ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=650;
        const eg = ctx.createGain(); eg.gain.value=0; oscillator.connect(filter).connect(eg).connect(gain); oscillator.start(); this.engine = oscillator; this.engineGain=eg;
        const buffer = ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate), data = buffer.getChannelData(0);
        for (let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
        const noise = ctx.createBufferSource(); noise.buffer=buffer; noise.loop=true;
        const ng = ctx.createGain(); ng.gain.value=0;
        const nf = ctx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=1700;
        noise.connect(nf).connect(ng).connect(gain); noise.start(); this.noiseGain=ng;
      }
      if (this.ctx.state==='suspended') await this.ctx.resume();
      this.syncLobbyMusic();
    } catch { /* Audio is optional: driving remains available when the browser blocks it. */ }
  }
  setMuted(value: boolean) {
    this.muted = value;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(value ? 0 : 0.18, this.ctx.currentTime, 0.03);
    this.syncLobbyMusic();
  }
  setLobby(active: boolean) {
    this.inLobby = active;
    this.syncLobbyMusic();
  }
  private syncLobbyMusic() {
    if (!this.inLobby || this.muted || this.ctx?.state !== 'running') {
      clearInterval(this.lobbyTimer);
      this.lobbyTimer = undefined;
      return;
    }
    if (this.lobbyTimer !== undefined) return;
    this.lobbyTimer = setInterval(() => {
      if (document.hidden || this.ctx?.state !== 'running') return;
      const step = this.lobbyStep++;
      const midi = lobbyNotes[step % lobbyNotes.length];
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      if (midi) this.tone(frequency, .16, .088, 'triangle');
      if (step % 4 === 0) {
        const bass = 440 * 2 ** ((lobbyBass[Math.floor(step / 8) % lobbyBass.length] - 69) / 12);
        this.tone(bass, .31, .1, 'sine');
      }
    }, 204);
  }
  update(speed: number, drift: boolean, boost: boolean, active: boolean) {
    if (!this.ctx || !this.engine || !this.engineGain || !this.noiseGain) return;
    const t=this.ctx.currentTime;
    this.engine.frequency.setTargetAtTime(35+speed*1.45+(boost?30:0),t,0.08);
    this.engineGain.gain.setTargetAtTime(active?0.07+speed*0.001:0,t,0.1);
    this.noiseGain.gain.setTargetAtTime(active?(drift?0.22:boost?0.14:speed*0.0008):0,t,0.08);
  }
  tone(frequency: number, duration = 0.12, volume = 0.35, type: OscillatorType = 'sine') {
    if (!this.ctx || !this.master) return;
    const ctx=this.ctx, oscillator=ctx.createOscillator(), gain=ctx.createGain();
    oscillator.frequency.value=frequency; oscillator.type=type; gain.gain.setValueAtTime(volume,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+duration);
    oscillator.connect(gain).connect(this.master); oscillator.start(); oscillator.stop(ctx.currentTime+duration);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
}
