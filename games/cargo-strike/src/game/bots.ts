import type { Match } from './match';
import { eye, type Actor } from './types';
import { distance, normalize } from './math';
import { moveBody, visible } from './map';
import { findPath } from './navigation';
export function updateBot(match: Match, bot: Actor, dt: number): void {
    if (match.settings.mode === 'practice')
        return;
    bot.repath -= dt;
    bot.reaction -= dt;
    const origin = eye(bot);
    const candidates = match.actors.filter(a => a.team !== bot.team && a.alive && a.shield <= 0 && distance(a.pos, bot.pos) < 51 && visible(origin, eye(a)));
    candidates.sort((a, b) => distance(a.pos, bot.pos) - distance(b.pos, bot.pos));
    const enemy = candidates[0];
    if (enemy) {
        if (bot.target !== enemy.id) {
            bot.target = enemy.id;
            bot.reaction = match.settings.difficulty === 'veteran' ? .24 : match.settings.difficulty === 'regular' ? .48 : .85;
        }
        const target = eye(enemy);
        target.y -= .35;
        const vector = normalize({ x: target.x - origin.x, y: target.y - origin.y, z: target.z - origin.z });
        bot.yaw = Math.atan2(-vector.x, -vector.z);
        bot.pitch = Math.asin(vector.y);
        const speed = 1.5, sign = bot.strafe;
        moveBody(bot.pos, Math.cos(bot.yaw) * dt * speed * sign, -Math.sin(bot.yaw) * dt * speed * sign, 1.8, true);
        bot.moving = 1;
        if (match.random() < dt * .5)
            bot.strafe = -bot.strafe;
        if (bot.reaction <= 0 && bot.cooldown <= 0 && bot.reload <= 0) {
            const spread = match.settings.difficulty === 'veteran' ? .026 : match.settings.difficulty === 'regular' ? .045 : .08;
            vector.x += (match.random() - .5) * spread;
            vector.y += (match.random() - .5) * spread;
            vector.z += (match.random() - .5) * spread;
            match.shoot(bot, normalize(vector));
            bot.cooldown = Math.max(bot.cooldown, match.settings.difficulty === 'veteran' ? .22 : .33);
        }
    }
    else {
        bot.target = -1;
        if (bot.repath <= 0 || bot.path.length === 0) {
            // Rotate attack lanes. BFS uses the same blockers as bullets and player movement.
            const human = match.player;
            const goal = bot.team === 1 && human.alive && match.random() < .55 ? human.pos :
                { x: (match.random() - .5) * 19, y: 0, z: (bot.team === 0 ? -1 : 1) * (6 + match.random() * 18) };
            bot.path = findPath(bot.pos, goal);
            bot.repath = 2 + match.random() * 2;
        }
        const next = bot.path[0];
        if (next) {
            const dx = next.x - bot.pos.x, dz = next.z - bot.pos.z, n = Math.hypot(dx, dz);
            if (n < .24)
                bot.path.shift();
            else {
                const speed = 3.3;
                moveBody(bot.pos, dx / n * dt * speed, dz / n * dt * speed, 1.8, true);
                bot.yaw = Math.atan2(-dx, -dz);
                bot.moving = 1;
            }
        }
        else
            bot.moving = 0;
    }
    if (bot.magazines[bot.weapon].ammo === 0)
        match.reload(bot);
}
