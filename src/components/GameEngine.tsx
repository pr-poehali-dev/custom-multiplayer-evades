import { useEffect, useRef, useState, useCallback } from "react";

interface CharDef {
  id: string;
  name: string;
  color: string;
  glow: string;
  stats: { speed: number; manaMax: number; manaRegen: number };
}

interface Props {
  character: CharDef;
  onBack: () => void;
}

interface Ball {
  id: number;
  x: number; // world space
  y: number; // world space (absolute, not offset)
  vx: number;
  vy: number;
  r: number;
}

interface Room {
  width: number;
  height: number;
}

const SAFE_ZONE = 200;

function makeRoom(level: number): Room {
  return {
    width: 1800 + level * 250,
    height: 220,
  };
}

function makeBalls(room: Room, level: number): Ball[] {
  const BALL_R = 12; // fixed size
  const count = 3 + level * 2;
  const balls: Ball[] = [];
  const speed = 0.8 + level * 0.2; // slower base speed
  for (let i = 0; i < count; i++) {
    const minX = SAFE_ZONE + BALL_R;
    const maxX = room.width - SAFE_ZONE - BALL_R;
    balls.push({
      id: i,
      x: minX + Math.random() * (maxX - minX),
      y: BALL_R + Math.random() * (room.height - BALL_R * 2),
      vx: (Math.random() > 0.5 ? 1 : -1) * (speed + Math.random() * speed * 0.4),
      vy: (Math.random() > 0.5 ? 1 : -1) * (speed * 0.7 + Math.random() * speed * 0.3),
      r: BALL_R,
    });
  }
  return balls;
}

const CANVAS_W = 900;
const CANVAS_H = 400;
// Corridor is centered vertically in canvas
const CORRIDOR_H = 220;
const CORRIDOR_TOP = (CANVAS_H - CORRIDOR_H) / 2; // 90
const PLAYER_R = 12;
const EXIT_W = 30;

interface AbilityState {
  id: string;
  level: number; // 0 = locked, 1-5 unlocked
  active: boolean;
}

interface PlayerStats {
  speedBase: number;
  manaMax: number;
  manaRegen: number;
  mana: number;
  skillPoints: number;
  abilities: AbilityState[];
}

function defaultStats(char: CharDef): PlayerStats {
  return {
    speedBase: char.stats.speed,
    manaMax: char.stats.manaMax,
    manaRegen: 1,
    mana: char.stats.manaMax,
    skillPoints: 0,
    abilities: [{ id: "boost", level: 0, active: false }],
  };
}

// Speed scaling: base speed 5 → very slow actual pixels/frame
// SPEED_SCALE maps stat "speed" to actual px/frame at 60fps
const SPEED_SCALE = 0.22;

function boostSpeedBonus(abilityLevel: number): number {
  if (abilityLevel === 0) return 0;
  return 1 + abilityLevel; // 1→+2, 2→+3 ... 5→+6
}

export default function GameEngine({ character, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [level, setLevel] = useState(1);
  const [dead, setDead] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [stats, setStats] = useState<PlayerStats>(() => defaultStats(character));

  const stateRef = useRef({
    // player world position
    px: 80,
    py: CORRIDOR_H / 2,
    vx: 0,
    vy: 0,
    // camera: world X that maps to canvas center
    camX: 80,
    keys: {} as Record<string, boolean>,
    balls: [] as Ball[],
    room: null as Room | null,
    dead: false,
    level: 1,
    speedBase: character.stats.speed,
    manaMax: character.stats.manaMax,
    manaRegen: 1,
    mana: character.stats.manaMax,
    skillPoints: 0,
    abilities: [{ id: "boost", level: 0, active: false }] as AbilityState[],
    lastManaTime: 0,
    lastAbilityManaTime: 0,
    frame: 0,
  });

  const animRef = useRef<number>(0);

  // Sync React → stateRef (except mana which game loop owns)
  useEffect(() => {
    const s = stateRef.current;
    s.speedBase = stats.speedBase;
    s.manaMax = stats.manaMax;
    s.manaRegen = stats.manaRegen;
    s.skillPoints = stats.skillPoints;
    // sync ability levels/active flags, preserve game-loop's active state
    s.abilities = stats.abilities.map(a => ({
      ...a,
      active: s.abilities.find(x => x.id === a.id)?.active ?? a.active,
    }));
  }, [stats]);

  const initRoom = useCallback((lvl: number) => {
    const room = makeRoom(lvl);
    const s = stateRef.current;
    s.room = room;
    s.balls = makeBalls(room, lvl);
    s.px = 80;
    s.py = CORRIDOR_H / 2;
    s.vx = 0;
    s.vy = 0;
    s.camX = 80;
    s.dead = false;
    s.level = lvl;
    for (const a of s.abilities) a.active = false;
  }, []);

  // Upgrade via keyboard (called from keydown handler)
  const upgradeRef = useRef<(what: string) => void>(() => {});

  useEffect(() => {
    upgradeRef.current = (what: string) => {
      setStats(prev => {
        if (prev.skillPoints <= 0) return prev;
        const s = stateRef.current;
        switch (what) {
          case "1": {
            const ns = { ...prev, speedBase: Math.round((prev.speedBase + 0.5) * 100) / 100, skillPoints: prev.skillPoints - 1 };
            s.speedBase = ns.speedBase; s.skillPoints = ns.skillPoints;
            return ns;
          }
          case "2": {
            const ns = { ...prev, manaMax: prev.manaMax + 5, skillPoints: prev.skillPoints - 1 };
            s.manaMax = ns.manaMax; s.skillPoints = ns.skillPoints;
            return ns;
          }
          case "3": {
            const ns = { ...prev, manaRegen: Math.round((prev.manaRegen + 0.2) * 100) / 100, skillPoints: prev.skillPoints - 1 };
            s.manaRegen = ns.manaRegen; s.skillPoints = ns.skillPoints;
            return ns;
          }
          case "4_upgrade": {
            const ab = prev.abilities.find(a => a.id === "boost")!;
            if (ab.level >= 5) return prev;
            const newAbilities = prev.abilities.map(a => a.id === "boost" ? { ...a, level: a.level + 1 } : a);
            const ns = { ...prev, abilities: newAbilities, skillPoints: prev.skillPoints - 1 };
            s.abilities = newAbilities.map(x => ({ ...x, active: s.abilities.find(y => y.id === x.id)?.active ?? false }));
            s.skillPoints = ns.skillPoints;
            return ns;
          }
          default: return prev;
        }
      });
    };
  });

  useEffect(() => {
    initRoom(1);
    stateRef.current.lastManaTime = performance.now();
    stateRef.current.lastAbilityManaTime = performance.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      stateRef.current.keys[key] = true;

      // Upgrade keys
      if (["1", "2", "3"].includes(e.key)) {
        upgradeRef.current(e.key);
      }
      // Key 4: toggle boost if unlocked, otherwise try upgrade
      if (e.key === "4") {
        const s = stateRef.current;
        const boost = s.abilities.find(a => a.id === "boost")!;
        if (boost.level > 0) {
          // toggle
          boost.active = !boost.active;
          const active = boost.active;
          if (active) s.lastAbilityManaTime = performance.now();
          setStats(prev => ({
            ...prev,
            abilities: prev.abilities.map(a => a.id === "boost" ? { ...a, active } : a),
          }));
        } else {
          // try upgrade (unlock)
          upgradeRef.current("4_upgrade");
        }
      }

      // Prevent arrow key scrolling only
      if (["arrowup","arrowdown","arrowleft","arrowright"].includes(key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;
      const s = stateRef.current;
      const room = s.room!;

      // ── Mana regen ──
      const manaElapsed = (now - s.lastManaTime) / 1000;
      if (manaElapsed >= 0.05) {
        s.mana = Math.min(s.manaMax, s.mana + s.manaRegen * manaElapsed);
        s.lastManaTime = now;
      }

      // ── Boost mana drain ──
      const boost = s.abilities.find(a => a.id === "boost")!;
      if (boost.active) {
        const ae = (now - s.lastAbilityManaTime) / 1000;
        if (ae >= 0.05) {
          s.mana = Math.max(0, s.mana - 2 * ae);
          s.lastAbilityManaTime = now;
          if (s.mana <= 0) {
            boost.active = false;
            setStats(prev => ({
              ...prev,
              abilities: prev.abilities.map(a => a.id === "boost" ? { ...a, active: false } : a),
            }));
          }
        }
      } else {
        s.lastAbilityManaTime = now;
      }

      // ── Move balls in world space ──
      // y is within [0, CORRIDOR_H], x within [SAFE_ZONE, room.width-SAFE_ZONE]
      for (const b of s.balls) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
        if (b.y > CORRIDOR_H - b.r) { b.y = CORRIDOR_H - b.r; b.vy = -Math.abs(b.vy); }
        if (b.x < SAFE_ZONE + b.r) { b.x = SAFE_ZONE + b.r; b.vx = Math.abs(b.vx); }
        if (b.x > room.width - SAFE_ZONE - b.r) { b.x = room.width - SAFE_ZONE - b.r; b.vx = -Math.abs(b.vx); }
      }

      if (!s.dead) {
        // ── Player movement — WASD only ──
        const boostBonus = boost.active ? boostSpeedBonus(boost.level) : 0;
        const totalSpeed = (s.speedBase + boostBonus) * SPEED_SCALE;
        let dvx = 0, dvy = 0;
        if (s.keys["w"]) dvy = -1;
        if (s.keys["s"]) dvy = 1;
        if (s.keys["a"]) dvx = -1;
        if (s.keys["d"]) dvx = 1;
        if (dvx !== 0 && dvy !== 0) { dvx *= 0.707; dvy *= 0.707; }
        // Smooth acceleration
        s.vx += (dvx * totalSpeed - s.vx) * 0.18;
        s.vy += (dvy * totalSpeed - s.vy) * 0.18;
        s.px += s.vx * dt;
        s.py += s.vy * dt;

        // Clamp player in corridor (world y: 0..CORRIDOR_H)
        s.py = Math.max(PLAYER_R, Math.min(CORRIDOR_H - PLAYER_R, s.py));
        // Clamp left boundary
        if (s.px < PLAYER_R) { s.px = PLAYER_R; s.vx = 0; }
        // Clamp right boundary at exit
        if (s.px > room.width + PLAYER_R) s.px = room.width + PLAYER_R;

        // ── Camera: follow player on X, keep player centered ──
        s.camX = s.px;

        // ── Collision detection (world space) ──
        for (const b of s.balls) {
          const dx = b.x - s.px;
          const dy = b.y - s.py;
          if (Math.sqrt(dx * dx + dy * dy) < b.r + PLAYER_R) {
            s.dead = true;
            boost.active = false;
            setDead(true);
            setStats(prev => ({
              ...prev,
              abilities: prev.abilities.map(a => ({ ...a, active: false })),
            }));
            break;
          }
        }

        // ── Check exit ──
        if (s.px >= room.width - EXIT_W * 0.5) {
          const nextLevel = s.level + 1;
          s.level = nextLevel;
          setLevel(nextLevel);
          setShowLevelUp(true);
          setTimeout(() => setShowLevelUp(false), 1500);
          initRoom(nextLevel);
          s.skillPoints += 1;
          setStats(prev => ({ ...prev, skillPoints: prev.skillPoints + 1 }));
        }
      }

      // ── Render ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#0d0d0f";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Camera offset: player is always at CANVAS_W/2
      const camOffsetX = CANVAS_W / 2 - s.camX;

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,0.025)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      const gridOffX = camOffsetX % gridSize;
      for (let x = ((gridOffX % gridSize) + gridSize) % gridSize; x < CANVAS_W; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
      }

      const corrTop = CORRIDOR_TOP;
      const corrBot = CORRIDOR_TOP + CORRIDOR_H;

      // Dark zones outside corridor
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, CANVAS_W, corrTop);
      ctx.fillRect(0, corrBot, CANVAS_W, CANVAS_H - corrBot);

      // ── Safe zones (world coords → screen via camOffsetX) ──
      // Start safe zone: world x [0, SAFE_ZONE]
      const safeStartSX = 0 + camOffsetX;
      const safeEndSX = (room.width - SAFE_ZONE) + camOffsetX;

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(100,150,255,0.2)";
      ctx.lineWidth = 1;

      // Start safe zone fill
      if (safeStartSX + SAFE_ZONE > 0 && safeStartSX < CANVAS_W) {
        ctx.fillStyle = "rgba(80,120,200,0.07)";
        const drawX = Math.max(0, safeStartSX);
        const drawW = Math.min(SAFE_ZONE, CANVAS_W - drawX);
        ctx.fillRect(drawX, corrTop, drawW, CORRIDOR_H);
        const borderX = safeStartSX + SAFE_ZONE;
        if (borderX > 0 && borderX < CANVAS_W) {
          ctx.beginPath(); ctx.moveTo(borderX, corrTop); ctx.lineTo(borderX, corrBot); ctx.stroke();
        }
      }
      // End safe zone fill
      if (safeEndSX < CANVAS_W && safeEndSX + SAFE_ZONE > 0) {
        ctx.fillStyle = "rgba(80,120,200,0.07)";
        const drawX = Math.max(0, safeEndSX);
        const drawW = Math.min(SAFE_ZONE + (room.width - safeEndSX - SAFE_ZONE + camOffsetX), CANVAS_W - drawX);
        ctx.fillRect(drawX, corrTop, Math.max(0, drawW + 100), CORRIDOR_H);
        if (safeEndSX > 0 && safeEndSX < CANVAS_W) {
          ctx.beginPath(); ctx.moveTo(safeEndSX, corrTop); ctx.lineTo(safeEndSX, corrBot); ctx.stroke();
        }
      }
      ctx.setLineDash([]);

      // Wall lines
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, corrTop); ctx.lineTo(CANVAS_W, corrTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, corrBot); ctx.lineTo(CANVAS_W, corrBot); ctx.stroke();

      // ── Exit portal ──
      const exitSX = room.width + camOffsetX;
      if (exitSX > 0 && exitSX < CANVAS_W + EXIT_W) {
        const grad = ctx.createLinearGradient(exitSX - EXIT_W, corrTop, exitSX, corrTop);
        grad.addColorStop(0, "rgba(255,220,0,0)");
        grad.addColorStop(1, "rgba(255,220,0,0.35)");
        ctx.fillStyle = grad;
        ctx.fillRect(exitSX - EXIT_W, corrTop, EXIT_W, CORRIDOR_H);
        ctx.strokeStyle = "rgba(255,220,0,0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(exitSX, corrTop); ctx.lineTo(exitSX, corrBot); ctx.stroke();
        const t = now / 1000;
        ctx.strokeStyle = `rgba(255,240,80,${0.3 + 0.3 * Math.sin(t * 3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(exitSX - 4, corrTop); ctx.lineTo(exitSX - 4, corrBot); ctx.stroke();
      }

      // Distance to exit
      const distToExit = Math.max(0, Math.round(room.width - s.px));
      ctx.fillStyle = "rgba(255,220,0,0.5)";
      ctx.font = "11px 'Oswald', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`выход: ${distToExit}px`, CANVAS_W - 16, corrTop - 10);

      // ── Balls ──
      for (const b of s.balls) {
        const bsx = b.x + camOffsetX;
        const bsy = b.y + corrTop;
        if (bsx < -b.r * 2 || bsx > CANVAS_W + b.r * 2) continue;
        ctx.save();
        const bglow = ctx.createRadialGradient(bsx, bsy, 0, bsx, bsy, b.r * 2.5);
        bglow.addColorStop(0, "rgba(160,160,160,0.15)");
        bglow.addColorStop(1, "rgba(160,160,160,0)");
        ctx.fillStyle = bglow;
        ctx.beginPath(); ctx.arc(bsx, bsy, b.r * 2.5, 0, Math.PI * 2); ctx.fill();
        const bg = ctx.createRadialGradient(bsx - b.r * 0.3, bsy - b.r * 0.3, 0, bsx, bsy, b.r);
        bg.addColorStop(0, "#cccccc");
        bg.addColorStop(1, "#555555");
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(bsx, bsy, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // ── Player (always at canvas center X) ──
      const psx = CANVAS_W / 2;
      const psy = s.py + corrTop;
      const boostActive = boost.active;
      const playerColor = boostActive ? blendToOrange(character.color, boost.level) : character.color;
      const playerGlow = boostActive ? "rgba(255,140,0,0.7)" : character.glow;

      if (!s.dead) {
        ctx.save();
        const pglow = ctx.createRadialGradient(psx, psy, 0, psx, psy, PLAYER_R * 3);
        pglow.addColorStop(0, playerGlow);
        pglow.addColorStop(1, "transparent");
        ctx.fillStyle = pglow;
        ctx.beginPath(); ctx.arc(psx, psy, PLAYER_R * 3, 0, Math.PI * 2); ctx.fill();
        const pgrad = ctx.createRadialGradient(psx - PLAYER_R * 0.3, psy - PLAYER_R * 0.3, 0, psx, psy, PLAYER_R);
        pgrad.addColorStop(0, lighten(playerColor, 40));
        pgrad.addColorStop(1, playerColor);
        ctx.fillStyle = pgrad;
        ctx.beginPath(); ctx.arc(psx, psy, PLAYER_R, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.2 * Math.sin(now / 200);
        ctx.strokeStyle = character.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(psx - PLAYER_R, psy - PLAYER_R); ctx.lineTo(psx + PLAYER_R, psy + PLAYER_R);
        ctx.moveTo(psx + PLAYER_R, psy - PLAYER_R); ctx.lineTo(psx - PLAYER_R, psy + PLAYER_R);
        ctx.stroke();
        ctx.restore();
      }

      // Sync mana to React
      if (s.frame % 6 === 0) {
        const liveMana = s.mana;
        setStats(prev => prev.mana === liveMana ? prev : { ...prev, mana: liveMana });
      }
      s.frame++;

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boostAbility = stats.abilities.find(a => a.id === "boost")!;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "#0d0d0f", fontFamily: "'Oswald', sans-serif" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between w-full px-6 py-3" style={{ maxWidth: CANVAS_W + 40 }}>
        <button
          onClick={onBack}
          className="text-xs tracking-widest uppercase"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          ← назад
        </button>
        <div className="flex items-center gap-6">
          <div className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
            УРОВЕНЬ <span style={{ color: "#fff", fontSize: 16 }}>{level}</span>
          </div>
          <div className="w-2 h-2 rounded-full" style={{ background: character.color, boxShadow: `0 0 8px ${character.glow}` }} />
          <span className="text-xs tracking-widest" style={{ color: character.color }}>{character.name}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative" style={{ width: CANVAS_W, border: "1px solid rgba(255,255,255,0.07)" }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display: "block", cursor: "none" }} />

        {dead && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <div className="text-4xl font-black tracking-widest" style={{ color: character.color, textShadow: `0 0 30px ${character.glow}` }}>
              ТЫ ПОГИБ
            </div>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>сольный режим — конец игры</div>
            <button
              onClick={() => {
                setDead(false);
                setLevel(1);
                const fresh = defaultStats(character);
                setStats(fresh);
                stateRef.current.mana = fresh.mana;
                stateRef.current.speedBase = fresh.speedBase;
                stateRef.current.manaMax = fresh.manaMax;
                stateRef.current.manaRegen = fresh.manaRegen;
                stateRef.current.skillPoints = 0;
                stateRef.current.abilities = fresh.abilities.map(a => ({ ...a }));
                initRoom(1);
              }}
              className="mt-3 px-10 py-2 text-sm font-bold tracking-[0.3em] uppercase"
              style={{ background: "rgba(255,255,255,0.9)", color: "#0d0d0f", cursor: "pointer" }}
            >
              НАЧАТЬ ЗАНОВО
            </button>
          </div>
        )}

        {showLevelUp && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-5xl font-black tracking-widest" style={{ color: "#ffd700", textShadow: "0 0 40px rgba(255,215,0,0.8)" }}>
              УРОВЕНЬ {level}
            </div>
          </div>
        )}
      </div>

      {/* ── HUD ── */}
      <div
        className="flex items-stretch gap-0 w-full"
        style={{ maxWidth: CANVAS_W, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderTop: "none" }}
      >
        {/* Skill points */}
        <div className="flex flex-col items-center justify-center px-4 py-2" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", minWidth: 64 }}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <div
              className="rounded-full"
              style={{
                width: 22, height: 22,
                background: stats.skillPoints > 0 ? "#ffd700" : "rgba(255,215,0,0.15)",
                boxShadow: stats.skillPoints > 0 ? "0 0 12px rgba(255,215,0,0.8)" : "none",
                transition: "all 0.3s",
              }}
            />
            {stats.skillPoints > 0 && (
              <span style={{
                position: "absolute", top: -6, right: -6,
                background: "#ffd700", color: "#0d0d0f", borderRadius: "50%",
                width: 14, height: 14, fontSize: 9, fontWeight: "bold",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {stats.skillPoints}
              </span>
            )}
          </div>
          <span style={{ color: "rgba(255,215,0,0.4)", fontSize: 8, marginTop: 3, letterSpacing: "0.05em" }}>ОЧКИ</span>
        </div>

        <StatBlock label="СКОРОСТЬ" value={`${stats.speedBase.toFixed(1)}`} keyHint="1" color="#aabbff" active={stats.skillPoints > 0} />
        <StatBlock
          label="МАКС МАНА" value={`${stats.manaMax}`} keyHint="2" color="#88aaff" active={stats.skillPoints > 0}
          extra={<ManaBar current={stats.mana} max={stats.manaMax} />}
        />
        <StatBlock label="РЕГЕН МАНЫ" value={`${stats.manaRegen.toFixed(1)}/с`} keyHint="3" color="#66aaee" active={stats.skillPoints > 0} />

        <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />

        <AbilityBlock
          keyHint="4"
          name="УСКОРЕНИЕ"
          abilityLevel={boostAbility.level}
          active={boostAbility.active}
          locked={boostAbility.level === 0}
          color={boostAbility.active ? "#ff9900" : "#ff4444"}
          canUpgrade={stats.skillPoints > 0 && boostAbility.level < 5}
        />
      </div>

      <div className="mt-3 text-xs tracking-[0.25em] uppercase" style={{ color: "rgba(255,255,255,0.1)" }}>
        WASD — движение · 1/2/3 — прокачка стата · 4 — разблокировать/включить ускорение
      </div>
    </div>
  );
}

function StatBlock({ label, value, keyHint, color, active, extra }: {
  label: string; value: string; keyHint: string; color: string; active: boolean; extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-center px-4 py-2" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", flex: 1, minWidth: 80 }}>
      <div className="flex items-center justify-between gap-2">
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: "0.1em" }}>{label}</span>
        <span className="text-xs px-1.5 py-0.5" style={{
          background: active ? "rgba(255,215,0,0.15)" : "transparent",
          color: active ? "#ffd700" : "rgba(255,255,255,0.15)",
          border: active ? "1px solid rgba(255,215,0,0.3)" : "1px solid transparent",
          fontSize: 9,
        }}>
          [{keyHint}]
        </span>
      </div>
      <div style={{ color, fontSize: 14, fontWeight: "bold", letterSpacing: "0.05em", marginTop: 2 }}>{value}</div>
      {extra}
    </div>
  );
}

function ManaBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(1, current / max));
  return (
    <div style={{ marginTop: 4, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
      <div style={{ height: "100%", width: `${pct * 100}%`, background: "linear-gradient(90deg,#4488ff,#88aaff)", borderRadius: 2, transition: "width 0.1s" }} />
    </div>
  );
}

function AbilityBlock({ keyHint, name, abilityLevel, active, locked, color, canUpgrade }: {
  keyHint: string; name: string; abilityLevel: number; active: boolean;
  locked: boolean; color: string; canUpgrade: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-2" style={{ minWidth: 120 }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="px-1.5 py-0.5" style={{
          background: "rgba(255,255,255,0.05)",
          color: locked ? "rgba(255,255,255,0.15)" : (active ? color : "rgba(255,255,255,0.4)"),
          border: `1px solid ${locked ? "rgba(255,255,255,0.06)" : (active ? color : "rgba(255,255,255,0.1)")}`,
          fontSize: 9,
        }}>
          [{keyHint}]
        </span>
        <span style={{ color: locked ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: "0.1em" }}>{name}</span>
      </div>
      <div className="rounded-full" style={{
        width: 20, height: 20, marginBottom: 4,
        background: locked ? "rgba(255,255,255,0.05)" : (active ? color : `${color}55`),
        boxShadow: active ? `0 0 10px ${color}` : "none",
        border: locked ? "1px solid rgba(255,255,255,0.08)" : `1px solid ${color}66`,
        transition: "all 0.3s",
      }} />
      <div className="flex gap-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="rounded-full" style={{
            width: 6, height: 6,
            background: i < abilityLevel ? "#ffd700" : "rgba(255,255,255,0.1)",
            boxShadow: i < abilityLevel ? "0 0 4px rgba(255,215,0,0.6)" : "none",
            transition: "all 0.3s",
          }} />
        ))}
      </div>
      {locked && canUpgrade && (
        <div style={{ color: "#ffd700", fontSize: 7, marginTop: 3, letterSpacing: "0.08em" }}>НАЖМИ [4]</div>
      )}
      {locked && !canUpgrade && (
        <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 7, marginTop: 3 }}>LOCKED</div>
      )}
    </div>
  );
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#",""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function blendToOrange(baseColor: string, level: number): string {
  const t = level / 5;
  const num = parseInt(baseColor.replace("#",""), 16);
  const r = Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * t);
  const g = Math.round((((num >> 8) & 0xff)) + (136 - ((num >> 8) & 0xff)) * t);
  const b = Math.round(((num & 0xff)) * (1 - t));
  return `rgb(${r},${g},${b})`;
}
