import { distance, type Vec3 } from './game/math';
import type { WeaponId } from './game/weapons';

const lobbyNotes = [50, 57, 0, 62, 57, 53, 0, 55, 48, 55, 0, 60, 55, 52, 0, 55, 46, 53, 0, 58, 57, 53, 0, 50, 48, 55, 0, 60, 58, 55, 0, 53];
const lobbyBass = [38, 36, 34, 36];

export class AudioEngine {
    context?: AudioContext;
    private master?: GainNode;
    private noise?: AudioBuffer;
    private inLobby = true;
    private lobbyTimer?: ReturnType<typeof setInterval>;
    private lobbyStep = 0;
    volume = .65;
    async start(): Promise<void> {
        if (!this.context) {
            this.context = new AudioContext();
            this.master = this.context.createGain();
            this.master.gain.value = this.volume;
            this.master.connect(this.context.destination);
            this.noise = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
            const data = this.noise.getChannelData(0);
            for (let i = 0; i < data.length; i++)
                data[i] = Math.random() * 2 - 1;
        }
        if (this.context.state === 'suspended')
            await this.context.resume();
        this.syncLobbyMusic();
    }
    setVolume(v: number): void {
        this.volume = v;
        if (this.master) this.master.gain.setTargetAtTime(v, this.context!.currentTime, .05);
        this.syncLobbyMusic();
    }
    setLobby(active: boolean) {
      this.inLobby = active;
      this.syncLobbyMusic();
    }
    private syncLobbyMusic() {
      if (!this.inLobby || this.volume <= 0 || this.context?.state !== 'running') {
        clearInterval(this.lobbyTimer);
        this.lobbyTimer = undefined;
        return;
      }
      if (this.lobbyTimer !== undefined) return;
      this.lobbyTimer = setInterval(() => {
        if (document.hidden || this.context?.state !== 'running') return;
        const step = this.lobbyStep++;
        const midi = lobbyNotes[step % lobbyNotes.length];
        const frequency = 440 * 2 ** ((midi - 69) / 12);
        if (midi) this.tone(frequency, frequency, .27, .053, 0, 'triangle');
        if (step % 4 === 0) {
          const bass = 440 * 2 ** ((lobbyBass[Math.floor(step / 8) % lobbyBass.length] - 69) / 12);
          this.tone(bass, bass, .5, .06);
        }
      }, 313);
    }
    private tone(frequency: number, end: number, duration: number, gain: number, delay = 0, type: OscillatorType = 'sine'): void {
        if (!this.context || !this.master)
            return;
        const t = this.context.currentTime + delay;
        const oscillator = this.context.createOscillator(), v = this.context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, t);
        oscillator.frequency.exponentialRampToValueAtTime(end, t + duration);
        v.gain.setValueAtTime(gain, t);
        v.gain.exponentialRampToValueAtTime(.001, t + duration);
        oscillator.connect(v);
        v.connect(this.master);
        oscillator.start(t);
        oscillator.stop(t + duration + .02);
        oscillator.onended = () => { oscillator.disconnect(); v.disconnect(); };
    }
    private burst(duration: number, gain: number, frequency: number, pan = 0, delay = 0): void {
        if (!this.context || !this.master || !this.noise)
            return;
        const t = this.context.currentTime + delay;
        const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), volume = this.context.createGain(), panner = this.context.createStereoPanner();
        source.buffer = this.noise;
        filter.type = 'lowpass';
        filter.frequency.value = frequency;
        panner.pan.value = pan;
        volume.gain.setValueAtTime(gain, t);
        volume.gain.exponentialRampToValueAtTime(.001, t + duration);
        source.connect(filter);
        filter.connect(volume);
        volume.connect(panner);
        panner.connect(this.master);
        source.start(t, Math.random());
        source.stop(t + duration + .02);
        source.onended = () => { source.disconnect(); filter.disconnect(); volume.disconnect(); panner.disconnect(); };
    }
    shot(weapon: WeaponId, source?: Vec3, listener?: Vec3, yaw = 0): void {
        const dist = source && listener ? distance(source, listener) : 0, gain = dist ? Math.min(.38, 4 / (dist + 6)) : .8;
        const pan = source && listener ? Math.max(-.85, Math.min(.85, ((source.x - listener.x) * Math.cos(yaw) - (source.z - listener.z) * Math.sin(yaw)) / 22)) : 0;
        this.burst(.095, gain, weapon === 'pistol' ? 4500 : 2500, pan);
        this.tone(weapon === 'awp' ? 115 : 180, 42, .13, gain * .55);
        this.burst(.3, gain * .23, 900, pan, .025);
        this.tone(2400, 1300, .035, gain * .08, .07, 'triangle');
    }
    reload(): void { this.burst(.06, .22, 3200); this.burst(.085, .2, 2400, 0, .65); this.tone(360, 180, .07, .16, 1.45, 'triangle'); }
    step(sprint: boolean): void { this.burst(.055, sprint ? .13 : .08, 550); this.tone(140, 65, .05, .045); }
    hit(head: boolean): void { this.tone(head ? 1900 : 1200, 800, .07, .13, 0, 'triangle'); }
    kill(): void { this.tone(660, 660, .09, .12); this.tone(880, 880, .12, .1, .075); }
    blast(): void { this.burst(.65, .8, 800); this.tone(72, 24, .6, .7); }
}
