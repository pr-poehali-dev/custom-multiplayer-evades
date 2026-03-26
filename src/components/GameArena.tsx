import { useEffect, useRef, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";

const CHARS = [
  { id: 0, name: "PHANTOM", color: "#00ffaa", speed: 4.5, health: 80, shape: "circle", ability: "dash" },
  { id: 1, name: "VORTEX", color: "#aa44ff", speed: 3.2, health: 100, shape: "triangle", ability: "pull" },
  { id: 2, name: "STRIKER", color: "#ff3366", speed: 3.8, health: 120, shape: "square", ability: "berserk" },
  { id: 3, name: "GHOST", color: "#33aaff", speed: 4.0, health: 70, shape: "circle", ability: "invisible" },
  { id: 4, name: "TITAN", color: "#ff8833", speed: 2.2, health: 180, shape: "pentagon", ability: "shield" },
];

const ARENA_COLORS = ["#00ffaa", "#aa44ff", "#ff3366"];

interface Enemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  color: string;
  type: "chaser" | "wanderer" | "shooter";
  shootTimer?: number;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromEnemy: boolean;
  color: string;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

interface Props {
  characterId: number;
  arenaId: number;
  playerName: string;
  onExit: () => void;
}

export default function GameArena({ characterId, arenaId, playerName, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    player: { x: 400, y: 300, vx: 0, vy: 0, hp: 100, maxHp: 100, abilityReady: true, abilityCooldown: 0, invisible: false, berserk: false, shielded: false },
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    score: 0,
    time: 0,
    kills: 0,
    keys: {} as Record<string, boolean>,
    mouse: { x: 400, y: 300 },
    bulletId: 0,
    enemyId: 0,
    shootTimer: 0,
    frameCount: 0,
    gameOver: false,
    spawnTimer: 0,
    dangerZones: [] as { x: number; y: number; r: number; timer: number }[],
  });
  const animRef = useRef<number>(0);
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [kills, setKills] = useState(0);
  const [time, setTime] = useState(0);
  const [abilityCd, setAbilityCd] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const char = CHARS[characterId];
  const arenaColor = ARENA_COLORS[arenaId];

  const spawnEnemy = useCallback(() => {
    const st = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const side = Math.floor(Math.random() * 4);
    let ex = 0, ey = 0;
    if (side === 0) { ex = Math.random() * canvas.width; ey = -20; }
    else if (side === 1) { ex = canvas.width + 20; ey = Math.random() * canvas.height; }
    else if (side === 2) { ex = Math.random() * canvas.width; ey = canvas.height + 20; }
    else { ex = -20; ey = Math.random() * canvas.height; }

    const types: Enemy["type"][] = ["chaser", "wanderer", "shooter"];
    const type = types[Math.floor(Math.random() * types.length)];
    const colors = ["#ff4444", "#ff8800", "#cc00ff", "#ff0066"];
    st.enemies.push({
      id: st.enemyId++,
      x: ex, y: ey,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      hp: type === "shooter" ? 2 : type === "chaser" ? 3 : 2,
      maxHp: type === "shooter" ? 2 : type === "chaser" ? 3 : 2,
      radius: type === "shooter" ? 10 : type === "chaser" ? 14 : 12,
      color: colors[Math.floor(Math.random() * colors.length)],
      type,
      shootTimer: 0,
    });
  }, []);

  const addParticles = useCallback((x: number, y: number, color: string, count = 8) => {
    const st = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 1 + Math.random() * 3;
      st.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color,
        radius: 2 + Math.random() * 3,
      });
    }
  }, []);

  const activateAbility = useCallback(() => {
    const st = stateRef.current;
    if (!st.player.abilityReady) return;
    st.player.abilityReady = false;

    if (char.ability === "dash") {
      const angle = Math.atan2(st.mouse.y - st.player.y, st.mouse.x - st.player.x);
      st.player.x += Math.cos(angle) * 120;
      st.player.y += Math.sin(angle) * 120;
      addParticles(st.player.x, st.player.y, char.color, 12);
      st.player.abilityCooldown = 180;
    } else if (char.ability === "pull") {
      st.enemies.forEach((e) => {
        const dx = st.player.x - e.x;
        const dy = st.player.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          e.vx += (dx / dist) * 8;
          e.vy += (dy / dist) * 8;
        }
      });
      addParticles(st.player.x, st.player.y, char.color, 20);
      st.player.abilityCooldown = 300;
    } else if (char.ability === "berserk") {
      st.player.berserk = true;
      setTimeout(() => { st.player.berserk = false; }, 4000);
      addParticles(st.player.x, st.player.y, char.color, 16);
      st.player.abilityCooldown = 480;
    } else if (char.ability === "invisible") {
      st.player.invisible = true;
      setTimeout(() => { st.player.invisible = false; }, 5000);
      st.player.abilityCooldown = 600;
    } else if (char.ability === "shield") {
      st.player.shielded = true;
      setTimeout(() => { st.player.shielded = false; }, 3000);
      addParticles(st.player.x, st.player.y, char.color, 24);
      st.player.abilityCooldown = 360;
    }
  }, [char, addParticles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const st = stateRef.current;
    st.player.x = canvas.width / 2;
    st.player.y = canvas.height / 2;
    st.player.hp = char.health;
    st.player.maxHp = char.health;

    // Initial enemies
    for (let i = 0; i < 5; i++) spawnEnemy();

    const onKey = (e: KeyboardEvent, down: boolean) => {
      st.keys[e.key.toLowerCase()] = down;
      if (down && e.key === " ") activateAbility();
    };
    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      st.mouse.x = e.clientX - rect.left;
      st.mouse.y = e.clientY - rect.top;
    };
    const onClick = () => {
      if (pausedRef.current || st.gameOver) return;
      const angle = Math.atan2(st.mouse.y - st.player.y, st.mouse.x - st.player.x);
      st.bullets.push({
        id: st.bulletId++,
        x: st.player.x, y: st.player.y,
        vx: Math.cos(angle) * 9,
        vy: Math.sin(angle) * 9,
        fromEnemy: false,
        color: char.color,
      });
    };

    window.addEventListener("keydown", (e) => onKey(e, true));
    window.addEventListener("keyup", (e) => onKey(e, false));
    canvas.addEventListener("mousemove", onMouse);
    canvas.addEventListener("click", onClick);

    const SPEED = char.speed;

    const loop = () => {
      if (!pausedRef.current && !st.gameOver) {
        st.frameCount++;
        st.time++;
        st.spawnTimer++;
        st.shootTimer++;

        // Spawn enemies
        const spawnRate = Math.max(90 - Math.floor(st.time / 600) * 8, 40);
        if (st.spawnTimer >= spawnRate) {
          spawnEnemy();
          if (st.time > 1200 && Math.random() < 0.4) spawnEnemy();
          st.spawnTimer = 0;
        }

        // Ability cooldown
        if (!st.player.abilityReady) {
          st.player.abilityCooldown--;
          if (st.player.abilityCooldown <= 0) st.player.abilityReady = true;
        }

        // Player movement
        let dx = 0, dy = 0;
        if (st.keys["w"] || st.keys["arrowup"]) dy -= 1;
        if (st.keys["s"] || st.keys["arrowdown"]) dy += 1;
        if (st.keys["a"] || st.keys["arrowleft"]) dx -= 1;
        if (st.keys["d"] || st.keys["arrowright"]) dx += 1;
        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
        st.player.vx = dx * SPEED;
        st.player.vy = dy * SPEED;
        st.player.x = Math.max(15, Math.min(canvas.width - 15, st.player.x + st.player.vx));
        st.player.y = Math.max(15, Math.min(canvas.height - 15, st.player.y + st.player.vy));

        // Update enemies
        st.enemies.forEach((e) => {
          if (e.type === "chaser" && !st.player.invisible) {
            const edx = st.player.x - e.x;
            const edy = st.player.y - e.y;
            const dist = Math.sqrt(edx * edx + edy * edy);
            if (dist > 0) { e.vx += (edx / dist) * 0.25; e.vy += (edy / dist) * 0.25; }
            const speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
            if (speed > 2.5) { e.vx = (e.vx / speed) * 2.5; e.vy = (e.vy / speed) * 2.5; }
          } else if (e.type === "wanderer") {
            e.vx += (Math.random() - 0.5) * 0.3;
            e.vy += (Math.random() - 0.5) * 0.3;
            const speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
            if (speed > 1.8) { e.vx = (e.vx / speed) * 1.8; e.vy = (e.vy / speed) * 1.8; }
          } else if (e.type === "shooter") {
            e.shootTimer = (e.shootTimer || 0) + 1;
            if (e.shootTimer > 120 && !st.player.invisible) {
              const edx = st.player.x - e.x;
              const edy = st.player.y - e.y;
              const dist = Math.sqrt(edx * edx + edy * edy);
              if (dist < 350) {
                st.bullets.push({
                  id: st.bulletId++,
                  x: e.x, y: e.y,
                  vx: (edx / dist) * 5,
                  vy: (edy / dist) * 5,
                  fromEnemy: true,
                  color: e.color,
                });
                e.shootTimer = 0;
              }
            }
            const edx = st.player.x - e.x;
            const edy = st.player.y - e.y;
            const dist = Math.sqrt(edx * edx + edy * edy);
            if (dist < 200) { e.vx -= (edx / dist) * 0.15; e.vy -= (edy / dist) * 0.15; }
          }
          e.x += e.vx;
          e.y += e.vy;
          e.x = Math.max(-30, Math.min(canvas.width + 30, e.x));
          e.y = Math.max(-30, Math.min(canvas.height + 30, e.y));

          // Player-enemy collision
          if (!st.player.shielded) {
            const cdx = st.player.x - e.x;
            const cdy = st.player.y - e.y;
            const dist = Math.sqrt(cdx * cdx + cdy * cdy);
            if (dist < e.radius + 15) {
              st.player.hp -= st.player.berserk ? 0 : 1;
              st.player.x += (cdx / dist) * 3;
              st.player.y += (cdy / dist) * 3;
            }
          }
        });

        // Update bullets
        st.bullets = st.bullets.filter((b) => {
          b.x += b.vx;
          b.y += b.vy;
          if (b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) return false;

          if (!b.fromEnemy) {
            for (let i = st.enemies.length - 1; i >= 0; i--) {
              const e = st.enemies[i];
              const dx = b.x - e.x;
              const dy = b.y - e.y;
              if (Math.sqrt(dx * dx + dy * dy) < e.radius) {
                const dmg = st.player.berserk ? 2 : 1;
                e.hp -= dmg;
                addParticles(e.x, e.y, e.color, 5);
                if (e.hp <= 0) {
                  addParticles(e.x, e.y, e.color, 15);
                  st.enemies.splice(i, 1);
                  st.kills++;
                  st.score += 100 + (e.type === "shooter" ? 50 : 0);
                }
                return false;
              }
            }
          } else {
            if (!st.player.shielded && !st.player.invisible) {
              const dx = b.x - st.player.x;
              const dy = b.y - st.player.y;
              if (Math.sqrt(dx * dx + dy * dy) < 15) {
                st.player.hp -= 5;
                addParticles(st.player.x, st.player.y, "#ffffff", 5);
                return false;
              }
            }
          }
          return true;
        });

        // Update particles
        st.particles = st.particles.filter((p) => {
          p.x += p.vx; p.y += p.vy;
          p.vx *= 0.92; p.vy *= 0.92;
          p.life--;
          return p.life > 0;
        });

        st.score++;

        if (st.player.hp <= 0) {
          st.player.hp = 0;
          st.gameOver = true;
          setGameOver(true);
        }

        // Sync UI every 6 frames
        if (st.frameCount % 6 === 0) {
          setScore(st.score);
          setHp(Math.max(0, st.player.hp));
          setKills(st.kills);
          setTime(st.time);
          const maxCd = char.ability === "dash" ? 180 : char.ability === "pull" ? 300 : char.ability === "berserk" ? 480 : char.ability === "invisible" ? 600 : 360;
          setAbilityCd(st.player.abilityReady ? 0 : Math.ceil((st.player.abilityCooldown / maxCd) * 100));
        }
      }

      // DRAW
      ctx.fillStyle = arenaId === 1 ? "#080810" : arenaId === 2 ? "#0d0808" : "#080808";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = `${arenaColor}08`;
      ctx.lineWidth = 1;
      const gridSize = arenaId === 1 ? 30 : 50;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Arena special effects
      if (arenaId === 2) {
        // Crater lava zones
        st.dangerZones.forEach((z) => {
          z.timer++;
          ctx.beginPath();
          ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,51,102,${0.05 + Math.sin(z.timer * 0.05) * 0.03})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255,51,102,0.2)`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      // Particles
      st.particles.forEach((p) => {
        const alpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });

      // Enemies
      st.enemies.forEach((e) => {
        // Shadow
        ctx.beginPath();
        ctx.arc(e.x + 2, e.y + 2, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fill();

        ctx.beginPath();
        if (e.type === "shooter") {
          // Diamond shape
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(Math.PI / 4);
          ctx.rect(-e.radius * 0.75, -e.radius * 0.75, e.radius * 1.5, e.radius * 1.5);
          ctx.restore();
        } else if (e.type === "wanderer") {
          ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        } else {
          // Triangle
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.beginPath();
          ctx.moveTo(0, -e.radius);
          ctx.lineTo(e.radius, e.radius * 0.7);
          ctx.lineTo(-e.radius, e.radius * 0.7);
          ctx.closePath();
          ctx.restore();
        }
        ctx.fillStyle = e.color + "44";
        ctx.fill();
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // HP bar
        if (e.hp < e.maxHp) {
          const bw = e.radius * 2;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, bw, 3);
          ctx.fillStyle = e.color;
          ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, bw * (e.hp / e.maxHp), 3);
        }
      });

      // Bullets
      st.bullets.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.fromEnemy ? 4 : 5, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Player
      const p = st.player;
      const playerAlpha = p.invisible ? 0.25 : 1;
      ctx.globalAlpha = playerAlpha;

      // Glow
      ctx.shadowColor = char.color;
      ctx.shadowBlur = p.berserk ? 25 : p.shielded ? 30 : 12;

      if (char.shape === "circle") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = char.color + "33";
        ctx.fill();
        ctx.strokeStyle = char.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (char.shape === "triangle") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(14, 12);
        ctx.lineTo(-14, 12);
        ctx.closePath();
        ctx.fillStyle = char.color + "33";
        ctx.fill();
        ctx.strokeStyle = char.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      } else if (char.shape === "square") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.PI / 8);
        ctx.fillStyle = char.color + "33";
        ctx.fillRect(-12, -12, 24, 24);
        ctx.strokeStyle = char.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -12, 24, 24);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = char.color + "33";
        ctx.fill();
        ctx.strokeStyle = char.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Shield ring
      if (p.shielded) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
        ctx.strokeStyle = char.color + "88";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Aim line
      if (!pausedRef.current && !st.gameOver) {
        const angle = Math.atan2(st.mouse.y - p.y, st.mouse.x - p.x);
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(angle) * 20, p.y + Math.sin(angle) * 20);
        ctx.lineTo(p.x + Math.cos(angle) * 40, p.y + Math.sin(angle) * 40);
        ctx.strokeStyle = char.color + "44";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Player name
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "bold 10px Oswald";
      ctx.textAlign = "center";
      ctx.fillText(playerName, p.x, p.y - 22);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", (e) => onKey(e, true));
      window.removeEventListener("keyup", (e) => onKey(e, false));
    };
  }, [characterId, arenaId, char, arenaColor, spawnEnemy, addParticles, playerName]);

  const togglePause = () => {
    setPaused((p) => { pausedRef.current = !p; return !p; });
  };

  const formatTime = (frames: number) => {
    const sec = Math.floor(frames / 60);
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  };

  const abilityKeys: Record<string, string> = {
    dash: "Рывок", pull: "Гравитация", berserk: "Берсерк", invisible: "Невидимость", shield: "Щит"
  };

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: "#080808" }}>
      {/* Canvas */}
      <canvas ref={canvasRef} className="w-full h-full" style={{ cursor: "crosshair" }} />

      {/* HUD Top */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-4 pointer-events-none">
        {/* Left: HP + char info */}
        <div className="flex flex-col gap-2">
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-sm"
            style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div
              className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-black"
              style={{ background: `${char.color}20`, color: char.color, fontFamily: "Oswald" }}
            >
              {char.name[0]}
            </div>
            <div>
              <div className="text-xs font-bold text-white mb-0.5" style={{ fontFamily: "Oswald" }}>{char.name}</div>
              <div className="flex items-center gap-1.5">
                <div className="w-28 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${(hp / char.health) * 100}%`, background: hp > char.health * 0.5 ? char.color : hp > char.health * 0.25 ? "#ff8833" : "#ff3366" }}
                  />
                </div>
                <span className="text-xs text-white/40">{hp}</span>
              </div>
            </div>
          </div>

          {/* Ability */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm"
            style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-xs text-white/40">ПРОБЕЛ</span>
            <span className="text-xs font-bold" style={{ color: char.color, fontFamily: "Oswald" }}>
              {abilityKeys[char.ability]}
            </span>
            {abilityCd > 0 ? (
              <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-white/30" style={{ width: `${100 - abilityCd}%` }} />
              </div>
            ) : (
              <span className="text-xs text-green-400">Готово</span>
            )}
          </div>
        </div>

        {/* Center: score + time */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="px-6 py-2 rounded-sm text-center"
            style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="text-2xl font-black text-white" style={{ fontFamily: "Oswald" }}>
              {score.toLocaleString()}
            </div>
            <div className="text-xs text-white/30">ОЧКОВ</div>
          </div>
          <div className="text-xs text-white/40 font-mono">{formatTime(time)}</div>
        </div>

        {/* Right: kills + controls */}
        <div className="flex flex-col gap-2 items-end pointer-events-auto">
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-sm"
            style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-1.5">
              <Icon name="Zap" size={12} style={{ color: char.color }} />
              <span className="text-sm font-black text-white" style={{ fontFamily: "Oswald" }}>{kills}</span>
              <span className="text-xs text-white/30">убийств</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={togglePause}
              className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors rounded-sm"
              style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "Oswald" }}
            >
              {paused ? "▶ ПРОДОЛЖИТЬ" : "⏸ ПАУЗА"}
            </button>
            <button
              onClick={onExit}
              className="px-3 py-1.5 text-xs text-white/40 hover:text-white/70 transition-colors rounded-sm"
              style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "Oswald" }}
            >
              ✕ ВЫЙТИ
            </button>
          </div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 text-xs text-white/20 pointer-events-none">
        <span>WASD — движение</span>
        <span>ЛКМ — выстрел</span>
        <span>ПРОБЕЛ — способность</span>
      </div>

      {/* Pause overlay */}
      {paused && !gameOver && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div
            className="text-center p-8 rounded-sm"
            style={{ background: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="text-3xl font-black text-white mb-2" style={{ fontFamily: "Oswald" }}>ПАУЗА</div>
            <div className="text-white/40 text-sm mb-6">Нажмите «Продолжить» или ESC</div>
            <button
              onClick={togglePause}
              className="w-full py-3 text-sm font-bold uppercase tracking-widest mb-3 transition-all hover:scale-105"
              style={{ fontFamily: "Oswald", background: char.color, color: "#0a0a0a" }}
            >
              ▶ Продолжить
            </button>
            <button
              onClick={onExit}
              className="w-full py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
              style={{ fontFamily: "Oswald" }}
            >
              Выйти в меню
            </button>
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div
            className="text-center p-8 rounded-sm min-w-[280px]"
            style={{ background: "rgba(10,10,10,0.98)", border: "1px solid rgba(255,51,102,0.3)" }}
          >
            <div className="text-4xl font-black mb-1" style={{ fontFamily: "Oswald", color: "#ff3366" }}>
              УБИТ
            </div>
            <div className="text-white/40 text-sm mb-6">Лучше в следующий раз</div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "Очков", value: score.toLocaleString() },
                { label: "Убийств", value: kills.toString() },
                { label: "Время", value: formatTime(time) },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-sm" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="text-lg font-black text-white" style={{ fontFamily: "Oswald" }}>{s.value}</div>
                  <div className="text-xs text-white/30">{s.label}</div>
                </div>
              ))}
            </div>
            <button
              onClick={onExit}
              className="w-full py-3 text-sm font-bold uppercase tracking-widest transition-all hover:scale-105"
              style={{ fontFamily: "Oswald", background: char.color, color: "#0a0a0a" }}
            >
              В главное меню
            </button>
          </div>
        </div>
      )}
    </div>
  );
}