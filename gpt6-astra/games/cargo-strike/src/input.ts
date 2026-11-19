import { emptyInput, type Input } from './game/types';
import { $ } from './ui/layout';
interface Actions {
    look: (dx: number, dy: number) => void;
    reload: () => void;
    switch: (slot: 1 | 2) => void;
    grenade: () => void;
    pause: () => void;
    scores: (show: boolean) => void;
    active: () => boolean;
    unlocked: () => void;
}
export class Controls {
    keys = new Set<string>();
    state: Input = emptyInput();
    touch = false;
    sensitivity = 1;
    drag = false;
    private last = { x: 0, y: 0 };
    private touchAim = false;
    private firing = false;
    private jump = false;
    private movement = { x: 0, y: 0 };
    constructor(private canvas: HTMLCanvasElement, private actions: Actions) {
        this.touch = matchMedia('(pointer: coarse)').matches;
        document.body.classList.toggle('touch', this.touch);
        window.addEventListener('keydown', e => {
            if (!actions.active())
                return;
            if (['Space', 'Tab', 'Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ControlLeft', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
                e.preventDefault();
            this.keys.add(e.code);
            if (e.repeat)
                return;
            if (e.code === 'KeyR')
                actions.reload();
            if (e.code === 'Digit1')
                actions.switch(1);
            if (e.code === 'Digit2')
                actions.switch(2);
            if (e.code === 'KeyG')
                actions.grenade();
            if (e.code === 'Escape')
                actions.pause();
            if (e.code === 'Tab')
                actions.scores(true);
        });
        window.addEventListener('keyup', e => { this.keys.delete(e.code); if (e.code === 'Tab') {
            e.preventDefault();
            actions.scores(false);
        } });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        canvas.addEventListener('pointerdown', e => {
            if (!actions.active() || e.pointerType === 'touch')
                return;
            this.drag = true;
            this.last = { x: e.clientX, y: e.clientY };
            if (e.button === 0)
                this.firing = true;
            if (e.button === 2)
                this.state.aim = true;
            if (!document.pointerLockElement)
                void this.capture();
        });
        window.addEventListener('pointerup', e => { this.drag = false; if (e.pointerType !== 'touch') {
            if (e.button === 0)
                this.firing = false;
            if (e.button === 2)
                this.state.aim = false;
        } });
        window.addEventListener('mousemove', e => {
            if (!actions.active())
                return;
            if (document.pointerLockElement === canvas)
                actions.look(e.movementX * this.sensitivity, e.movementY * this.sensitivity);
            else if (this.drag) {
                actions.look((e.clientX - this.last.x) * this.sensitivity, (e.clientY - this.last.y) * this.sensitivity);
                this.last = { x: e.clientX, y: e.clientY };
            }
        });
        document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && actions.active()) {
            this.reset();
            actions.unlocked();
        } });
        window.addEventListener('blur', () => { this.reset(); if (actions.active())
            actions.pause(); });
        document.addEventListener('visibilitychange', () => { if (document.hidden) {
            this.reset();
            if (actions.active())
                actions.pause();
        } });
        this.bindTouch();
    }
    async capture(): Promise<void> {
        if (this.touch)
            return;
        try {
            if (this.canvas.requestPointerLock)
                await this.canvas.requestPointerLock();
        }
        catch {
            $('mouse-hint').classList.remove('hidden');
        }
    }
    reset(): void { this.keys.clear(); this.firing = false; this.jump = false; this.state = emptyInput(); this.touchAim = false; this.drag = false; this.movement = { x: 0, y: 0 }; $('move-pad').querySelector('i')!.style.transform = 'translate(0,0)'; this.actions.scores(false); }
    read(): Input {
        const k = this.keys;
        this.state.forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - this.movement.y;
        this.state.right = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.movement.x;
        this.state.jump = k.has('Space') || this.jump;
        this.state.crouch = k.has('ControlLeft') || k.has('KeyC');
        this.state.sprint = k.has('ShiftLeft');
        this.state.fire = this.firing;
        if (this.touch)
            this.state.aim = this.touchAim;
        return this.state;
    }
    private bindTouch(): void {
        const hold = (id: string, set: (v: boolean) => void) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); set(true); }); for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
            el.addEventListener(event, () => set(false)); };
        hold('touch-fire', v => this.firing = v);
        hold('touch-jump', v => this.jump = v);
        $('touch-aim').onclick = () => { this.touchAim = !this.touchAim; };
        $('touch-reload').onclick = () => this.actions.reload();
        $('touch-grenade').onclick = () => this.actions.grenade();
        const move = $('move-pad');
        let moveId: number | undefined;
        const update = (e: PointerEvent) => { const r = move.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / 45, dy = (e.clientY - r.top - r.height / 2) / 45, n = Math.max(1, Math.hypot(dx, dy)); this.movement = { x: dx / n, y: dy / n }; move.querySelector('i')!.style.transform = `translate(${dx / n * 35}px,${dy / n * 35}px)`; };
        move.addEventListener('pointerdown', e => { moveId = e.pointerId; move.setPointerCapture(e.pointerId); update(e); });
        move.addEventListener('pointermove', e => { if (e.pointerId === moveId)
            update(e); });
        for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
            move.addEventListener(name, () => { moveId = undefined; this.movement = { x: 0, y: 0 }; move.querySelector('i')!.style.transform = 'translate(0,0)'; });
        const look = $('look-pad');
        let lookId: number | undefined;
        let last = { x: 0, y: 0 };
        look.addEventListener('pointerdown', e => { lookId = e.pointerId; last = { x: e.clientX, y: e.clientY }; look.setPointerCapture(e.pointerId); });
        look.addEventListener('pointermove', e => { if (lookId !== e.pointerId)
            return; this.actions.look((e.clientX - last.x) * 1.5 * this.sensitivity, (e.clientY - last.y) * 1.5 * this.sensitivity); last = { x: e.clientX, y: e.clientY }; });
        for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
            look.addEventListener(name, () => { lookId = undefined; });
    }
}
