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
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Room {
  width: number;
  height: number;
  balls: BallDef[];
}

interface BallDef {
  x: number; y: number; vx: number; vy: number; r: number;
}

// Safe zone width at start and end of corridor (enemy-free)
const SAFE_ZONE = 180;

function makeRoom(level: number): Room {
  const height = 220;
  const width = 1600 + level * 200;
  const count = 3 + level * 2;
  const balls: BallDef[] = [];
  const speed = 1.5 + level * 0.35;
  for (let i = 0; i < count; i++) {
    const r = 10 + Math.random() * 8;
    // spawn only in the playable zone (between safe zones)
    const minX = SAFE_ZONE + r;
    const maxX = width - SAFE_ZONE - r;
    balls.push({
      x: minX + Math.random() * (maxX - minX),
      y: r + Math.random() * (height - r * 2),
      vx: (Math.random() > 0.5 ? 1 : -1) * (speed + Math.random() * speed * 0.5),
      vy: (Math.random() > 0.5 ? 1 : -1) * (speed * 0.6 + Math.random() * speed * 0.4),
      r,
    });
  }
  return { width, height, balls };
}

const CANVAS_W = 900;
const CANVAS_H = 400;
const CORRIDOR_Y_OFFSET = 90;
const CORRIDOR_H = 220;
const PLAYER_R = 12;
const EXIT_W = 30;
const EXIT_H = CORRIDOR_H;

// ── Abilities ─────────────────────────────────────────────────────────────────
interface AbilityState {
  id: string;
  level: number; // 0 = locked, 1-5 = unlocked+level
  active: boolean;
}

// ── Player upgradeable stats ──────────────────────────────────────────────────
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
    abilities: [
      { id: "boost", level: 0, active: false },
    ],
  };
}

export default function GameEngine({ character, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Reactive state for UI
  const [level, setLevel] = useState(1);
  const [dead, setDead] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [stats, setStats] = useState<PlayerStats>(() => defaultStats(character));

  // Mutable game state (not causing re-renders)
  const stateRef = useRef({
    px: 80,
    py: CORRIDOR_Y_OFFSET + CORRIDOR_H / 2,
    vx: 0,
    vy: 0,
    camX: 0,
    keys: {} as Record<string, boolean>,
    balls: [] as Ball[],
    room: null as Room | null,
    dead: false,
    level: 1,
    // Live copies of upgradeable stats (synced from React state)
    speedBase: character.stats.speed,
    manaMax: character.stats.manaMax,
    manaRegen: 1,
    mana: character.stats.manaMax,
    skillPoints: 0,
    abilities: [{ id: "boost", level: 0, active: false }] as AbilityState[],
    lastManaTime: 0,
    lastAbilityManaTime: 0,
  });

  const animRef = useRef<number>(0);

  // ── Sync React stats → stateRef on change ────────────────────────────────
  useEffect(() => {
    const s = stateRef.current;
    s.speedBase = stats.speedBase;
    s.manaMax = stats.manaMax;
    s.manaRegen = stats.manaRegen;
    s.skillPoints = stats.skillPoints;
    s.abilities = stats.abilities.map(a => ({ ...a }));
    // don't override mana live (game loop manages it)
  }, [stats]);

  // ── Init room ───────────────────────────────────────────────────────────────
  const initRoom = useCallback((lvl: number) => {
    const room = makeRoom(lvl);
    const s = stateRef.current;
    s.room = room;
    s.balls = room.balls.map((b, i) => ({ ...b, id: i }));
    s.px = 80;
    s.py = CORRIDOR_Y_OFFSET + CORRIDOR_H / 2;
    s.camX = 0;
    s.dead = false;
    s.level = lvl;
    // deactivate abilities on respawn
    for (const a of s.abilities) a.active = false;
  }, []);

  // ── Ability boost speed bonus ─────────────────────────────────────────────
  function boostSpeedBonus(abilityLevel: number): number {
    if (abilityLevel === 0) return 0;
    return 1 + abilityLevel; // level1→+2, 2→+3, 3→+4, 4→+5, 5→+6
  }

  // ── Game loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    initRoom(1);
    stateRef.current.lastManaTime = performance.now();
    stateRef.current.lastAbilityManaTime = performance.now();

    const downListeners: ((e: KeyboardEvent) => void)[] = [];
    const upListeners: ((e: KeyboardEvent) => void)[] = [];

    const handleKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = true;
      // Ability 1 - boost: key "4"
      if (e.key === "4") {
        const s = stateRef.current;
        const boost = s.abilities.find(a => a.id === "boost");
        if (boost && boost.level > 0) {
          boost.active = !boost.active;
          setStats(prev => ({
            ...prev,
            abilities: prev.abilities.map(a =>
              a.id === "boost" ? { ...a, active: !a.active } : a
            ),
          }));
        }
      }
      e.preventDefault();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = false;
    };

    downListeners.push(handleKeyDown);
    upListeners.push(handleKeyUp);
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
      if (manaElapsed >= 0.1) {
        s.mana = Math.min(s.manaMax, s.mana + s.manaRegen * manaElapsed);
        s.lastManaTime = now;
      }

      // ── Active ability: boost costs 2/s (net -1/s with 1 regen) ──
      const boost = s.abilities.find(a => a.id === "boost");
      if (boost && boost.active) {
        const abilityElapsed = (now - s.lastAbilityManaTime) / 1000;
        if (abilityElapsed >= 0.1) {
          s.mana = Math.max(0, s.mana - 2 * abilityElapsed);
          s.lastAbilityManaTime = now;
          if (s.mana <= 0) {
            boost.active = false;
            setStats(prev => ({
              ...prev,
              abilities: prev.abilities.map(a =>
                a.id === "boost" ? { ...a, active: false } : a
              ),
            }));
          }
        }
      } else {
        s.lastAbilityManaTime = now;
      }

      // ── Move balls (respect safe zones) ──
      for (const b of s.balls) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const top = CORRIDOR_Y_OFFSET + b.r;
        const bot = CORRIDOR_Y_OFFSET + CORRIDOR_H - b.r;
        // Bounce off safe zone walls
        const leftBound = SAFE_ZONE;
        const rightBound = room.width - SAFE_ZONE;
        if (b.y < top) { b.y = top; b.vy = Math.abs(b.vy); }
        if (b.y > bot) { b.y = bot; b.vy = -Math.abs(b.vy); }
        if (b.x < leftBound) { b.x = leftBound; b.vx = Math.abs(b.vx); }
        if (b.x > rightBound) { b.x = rightBound; b.vx = -Math.abs(b.vx); }
      }

      if (!s.dead) {
        // ── Move player ──
        const boostBonus = (boost && boost.active) ? boostSpeedBonus(boost.level) : 0;
        const totalSpeed = s.speedBase + boostBonus;
        const spd = totalSpeed * 1.2;
        let dvx = 0, dvy = 0;
        if (s.keys["w"] || s.keys["arrowup"]) dvy = -1;
        if (s.keys["s"] || s.keys["arrowdown"]) dvy = 1;
        if (s.keys["a"] || s.keys["arrowleft"]) dvx = -1;
        if (s.keys["d"] || s.keys["arrowright"]) dvx = 1;
        if (dvx !== 0 && dvy !== 0) { dvx *= 0.707; dvy *= 0.707; }
        s.vx += (dvx * spd - s.vx) * 0.2;
        s.vy += (dvy * spd - s.vy) * 0.2;
        s.px += s.vx * dt;
        s.py += s.vy * dt;

        s.py = Math.max(CORRIDOR_Y_OFFSET + PLAYER_R, Math.min(CORRIDOR_Y_OFFSET + CORRIDOR_H - PLAYER_R, s.py));
        if (s.px < PLAYER_R) { s.px = PLAYER_R; s.vx = 0; }

        // ── Camera ──
        const targetCamX = s.px - CANVAS_W * 0.35;
        s.camX += (targetCamX - s.camX) * 0.08 * dt;
        if (s.camX < 0) s.camX = 0;

        // ── Collision (only in non-safe zones) ──
        for (const b of s.balls) {
          const dx = b.x - (s.px + s.camX);
          const dy = b.y - s.py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < b.r + PLAYER_R) {
            s.dead = true;
            setDead(true);
            // deactivate boost
            if (boost) boost.active = false;
            setStats(prev => ({
              ...prev,
              abilities: prev.abilities.map(a => ({ ...a, active: false })),
            }));
            break;
          }
        }

        // ── Check exit ──
        const exitScreenX = room.width - s.camX;
        const inExit =
          s.px >= exitScreenX - EXIT_W * 0.5 &&
          s.py >= CORRIDOR_Y_OFFSET &&
          s.py <= CORRIDOR_Y_OFFSET + EXIT_H;
        if (inExit) {
          const nextLevel = s.level + 1;
          s.level = nextLevel;
          setLevel(nextLevel);
          setShowLevelUp(true);
          setTimeout(() => setShowLevelUp(false), 1500);
          initRoom(nextLevel);
          // Give skill point
          setStats(prev => ({ ...prev, skillPoints: prev.skillPoints + 1 }));
          s.skillPoints += 1;
        }
      }

      // ── Draw ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#0d0d0f";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,0.025)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      const gridOffX = (-s.camX) % gridSize;
      for (let x = gridOffX; x < CANVAS_W; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
      }

      const corrTop = CORRIDOR_Y_OFFSET;
      const corrBot = CORRIDOR_Y_OFFSET + CORRIDOR_H;

      // Dark zones outside corridor
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, CANVAS_W, corrTop);
      ctx.fillRect(0, corrBot, CANVAS_W, CANVAS_H - corrBot);

      // ── Safe zone backgrounds ──
      const safeStartScreenX = -s.camX;
      const safeEndScreenX = room.width - SAFE_ZONE - s.camX;

      // Start safe zone (player spawn)
      if (safeStartScreenX < CANVAS_W && safeStartScreenX + SAFE_ZONE > 0) {
        ctx.fillStyle = "rgba(80,120,200,0.07)";
        ctx.fillRect(Math.max(0, safeStartScreenX), corrTop, Math.min(SAFE_ZONE, CANVAS_W - safeStartScreenX), CORRIDOR_H);
        ctx.strokeStyle = "rgba(100,150,255,0.2)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const safeRightX = safeStartScreenX + SAFE_ZONE;
        if (safeRightX > 0 && safeRightX < CANVAS_W) {
          ctx.beginPath(); ctx.moveTo(safeRightX, corrTop); ctx.lineTo(safeRightX, corrBot); ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // End safe zone (exit area)
      if (safeEndScreenX < CANVAS_W && safeEndScreenX + SAFE_ZONE > 0) {
        ctx.fillStyle = "rgba(80,120,200,0.07)";
        ctx.fillRect(Math.max(0, safeEndScreenX), corrTop, Math.min(SAFE_ZONE, CANVAS_W - safeEndScreenX), CORRIDOR_H);
        ctx.strokeStyle = "rgba(100,150,255,0.2)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        if (safeEndScreenX > 0 && safeEndScreenX < CANVAS_W) {
          ctx.beginPath(); ctx.moveTo(safeEndScreenX, corrTop); ctx.lineTo(safeEndScreenX, corrBot); ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // Wall lines
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, corrTop); ctx.lineTo(CANVAS_W, corrTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, corrBot); ctx.lineTo(CANVAS_W, corrBot); ctx.stroke();

      // ── Exit portal ──
      const exitSX = room.width - s.camX;
      if (exitSX > 0 && exitSX < CANVAS_W + EXIT_W) {
        const grad = ctx.createLinearGradient(exitSX - EXIT_W, corrTop, exitSX, corrTop);
        grad.addColorStop(0, "rgba(255,220,0,0)");
        grad.addColorStop(1, "rgba(255,220,0,0.35)");
        ctx.fillStyle = grad;
        ctx.fillRect(exitSX - EXIT_W, corrTop, EXIT_W, CORRIDOR_H);
        ctx.strokeStyle = "rgba(255,220,0,0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(exitSX, corrTop); ctx.lineTo(exitSX, corrBot); ctx.stroke();
        const t = performance.now() / 1000;
        ctx.strokeStyle = `rgba(255,240,80,${0.3 + 0.3 * Math.sin(t * 3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(exitSX - 4, corrTop); ctx.lineTo(exitSX - 4, corrBot); ctx.stroke();
      }

      // Distance label
      const distToExit = Math.max(0, Math.round(room.width - (s.px + s.camX)));
      ctx.fillStyle = "rgba(255,220,0,0.5)";
      ctx.font = "11px 'Oswald', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`выход: ${distToExit}px`, CANVAS_W - 16, corrTop - 10);

      // ── Balls ──
      for (const b of s.balls) {
        const bx = b.x - s.camX;
        const by = b.y;
        if (bx < -b.r * 2 || bx > CANVAS_W + b.r * 2) continue;
        ctx.save();
        const bglow = ctx.createRadialGradient(bx, by, 0, bx, by, b.r * 2.5);
        bglow.addColorStop(0, "rgba(160,160,160,0.15)");
        bglow.addColorStop(1, "rgba(160,160,160,0)");
        ctx.fillStyle = bglow;
        ctx.beginPath(); ctx.arc(bx, by, b.r * 2.5, 0, Math.PI * 2); ctx.fill();
        const ballGrad = ctx.createRadialGradient(bx - b.r * 0.3, by - b.r * 0.3, 0, bx, by, b.r);
        ballGrad.addColorStop(0, "#cccccc");
        ballGrad.addColorStop(1, "#555555");
        ctx.fillStyle = ballGrad;
        ctx.beginPath(); ctx.arc(bx, by, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // ── Player ──
      const boostActive = boost && boost.active;
      const playerColor = boostActive ? blendToOrange(character.color, boost!.level) : character.color;
      const playerGlow = boostActive ? "rgba(255,140,0,0.7)" : character.glow;

      if (!s.dead) {
        const px = s.px;
        const py = s.py;
        ctx.save();
        const pglow = ctx.createRadialGradient(px, py, 0, px, py, PLAYER_R * 3);
        pglow.addColorStop(0, playerGlow);
        pglow.addColorStop(1, "transparent");
        ctx.fillStyle = pglow;
        ctx.beginPath(); ctx.arc(px, py, PLAYER_R * 3, 0, Math.PI * 2); ctx.fill();
        const pgrad = ctx.createRadialGradient(px - PLAYER_R * 0.3, py - PLAYER_R * 0.3, 0, px, py, PLAYER_R);
        pgrad.addColorStop(0, lighten(playerColor, 40));
        pgrad.addColorStop(1, playerColor);
        ctx.fillStyle = pgrad;
        ctx.beginPath(); ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        // Dead — transparent X, no blur
        const px = s.px;
        const py = s.py;
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.2 * Math.sin(Date.now() / 200);
        ctx.strokeStyle = character.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px - PLAYER_R, py - PLAYER_R);
        ctx.lineTo(px + PLAYER_R, py + PLAYER_R);
        ctx.moveTo(px + PLAYER_R, py - PLAYER_R);
        ctx.lineTo(px - PLAYER_R, py + PLAYER_R);
        ctx.stroke();
        ctx.restore();
      }

      // Sync mana to React state (throttled every ~10 frames)
      if (s.frame % 10 === 0) {
        const liveMana = s.mana;
        setStats(prev => ({ ...prev, mana: liveMana }));
      }
      s.frame = (s.frame ?? 0) + 1;

      animRef.current = requestAnimationFrame(loop);
    };

    // frame counter
    stateRef.current.frame = 0;

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Skill point upgrade handlers ─────────────────────────────────────────
  const upgrade = useCallback((what: "speed" | "mana" | "regen" | "ability_boost") => {
    setStats(prev => {
      if (prev.skillPoints <= 0) return prev;
      const s = stateRef.current;
      switch (what) {
        case "speed": {
          const ns = { ...prev, speedBase: prev.speedBase + 0.5, skillPoints: prev.skillPoints - 1 };
          s.speedBase = ns.speedBase;
          s.skillPoints = ns.skillPoints;
          return ns;
        }
        case "mana": {
          const ns = { ...prev, manaMax: prev.manaMax + 5, skillPoints: prev.skillPoints - 1 };
          s.manaMax = ns.manaMax;
          s.skillPoints = ns.skillPoints;
          return ns;
        }
        case "regen": {
          const ns = { ...prev, manaRegen: Math.round((prev.manaRegen + 0.2) * 100) / 100, skillPoints: prev.skillPoints - 1 };
          s.manaRegen = ns.manaRegen;
          s.skillPoints = ns.skillPoints;
          return ns;
        }
        case "ability_boost": {
          const ab = prev.abilities.find(a => a.id === "boost")!;
          if (ab.level >= 5) return prev;
          const newAbilities = prev.abilities.map(a =>
            a.id === "boost" ? { ...a, level: a.level + 1 } : a
          );
          const ns = { ...prev, abilities: newAbilities, skillPoints: prev.skillPoints - 1 };
          s.abilities = newAbilities.map(a => ({ ...a }));
          s.skillPoints = ns.skillPoints;
          return ns;
        }
        default: return prev;
      }
    });
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
          className="text-xs tracking-widest uppercase transition-all"
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

        {/* Death overlay — no blur, just dark tint */}
        {dead && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <div
              className="text-4xl font-black tracking-widest"
              style={{ color: character.color, textShadow: `0 0 30px ${character.glow}` }}
            >
              ТЫ ПОГИБ
            </div>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              сольный режим — конец игры
            </div>
            <button
              onClick={() => {
                setDead(false);
                setLevel(1);
                setStats(defaultStats(character));
                stateRef.current.mana = character.stats.manaMax;
                initRoom(1);
              }}
              className="mt-3 px-10 py-2 text-sm font-bold tracking-[0.3em] uppercase transition-all"
              style={{
                background: "rgba(255,255,255,0.9)",
                color: "#0d0d0f",
                cursor: "pointer",
              }}
            >
              НАЧАТЬ ЗАНОВО
            </button>
          </div>
        )}

        {/* Level up popup */}
        {showLevelUp && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="text-5xl font-black tracking-widest animate-slide-up"
              style={{ color: "#ffd700", textShadow: "0 0 40px rgba(255,215,0,0.8)" }}
            >
              УРОВЕНЬ {level}
            </div>
          </div>
        )}
      </div>

      {/* ── HUD: stats bar ── */}
      <div
        className="flex items-stretch gap-0 w-full"
        style={{
          maxWidth: CANVAS_W,
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderTop: "none",
        }}
      >
        {/* Skill points indicator (yellow ball + number) */}
        <div
          className="flex flex-col items-center justify-center px-4 py-2"
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)", minWidth: 64 }}
        >
          <div style={{ position: "relative", display: "inline-flex" }}>
            <div
              className="rounded-full"
              style={{
                width: 22,
                height: 22,
                background: stats.skillPoints > 0 ? "#ffd700" : "rgba(255,215,0,0.15)",
                boxShadow: stats.skillPoints > 0 ? "0 0 12px rgba(255,215,0,0.8)" : "none",
                transition: "all 0.3s",
              }}
            />
            {stats.skillPoints > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "#ffd700",
                  color: "#0d0d0f",
                  borderRadius: "50%",
                  width: 14,
                  height: 14,
                  fontSize: 9,
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {stats.skillPoints}
              </span>
            )}
          </div>
          <span style={{ color: "rgba(255,215,0,0.4)", fontSize: 8, marginTop: 3, letterSpacing: "0.05em" }}>ОЧКИ</span>
        </div>

        {/* Stat: Speed */}
        <StatBlock
          label="СКОРОСТЬ"
          value={`${stats.speedBase.toFixed(1)}`}
          keyHint="1"
          color="#aabbff"
          canUpgrade={stats.skillPoints > 0}
          onUpgrade={() => upgrade("speed")}
        />

        {/* Stat: Max Mana */}
        <StatBlock
          label="МАКС МАНА"
          value={`${stats.manaMax}`}
          keyHint="2"
          color="#88aaff"
          canUpgrade={stats.skillPoints > 0}
          onUpgrade={() => upgrade("mana")}
          extra={
            <ManaBar current={stats.mana} max={stats.manaMax} />
          }
        />

        {/* Stat: Mana Regen */}
        <StatBlock
          label="РЕГЕН МАНЫ"
          value={`${stats.manaRegen.toFixed(1)}/с`}
          keyHint="3"
          color="#66aaee"
          canUpgrade={stats.skillPoints > 0}
          onUpgrade={() => upgrade("regen")}
        />

        {/* Divider */}
        <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />

        {/* Ability: Boost (key 4) */}
        <AbilityBlock
          keyHint="4"
          name="УСКОРЕНИЕ"
          abilityLevel={boostAbility.level}
          active={boostAbility.active}
          locked={boostAbility.level === 0}
          color={boostAbility.active ? "#ff9900" : "#ff4444"}
          canUpgrade={stats.skillPoints > 0 && boostAbility.level < 5}
          onUpgrade={() => upgrade("ability_boost")}
        />
      </div>

      {/* Bottom hint */}
      <div className="mt-3 text-xs tracking-[0.25em] uppercase" style={{ color: "rgba(255,255,255,0.1)" }}>
        WASD — движение · 1/2/3 — прокачка · 4 — ускорение
      </div>
    </div>
  );
}

// ── StatBlock component ───────────────────────────────────────────────────────
function StatBlock({
  label, value, keyHint, color, canUpgrade, onUpgrade, extra,
}: {
  label: string; value: string; keyHint: string; color: string;
  canUpgrade: boolean; onUpgrade: () => void; extra?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col justify-center px-4 py-2 cursor-pointer relative group"
      style={{ borderRight: "1px solid rgba(255,255,255,0.06)", flex: 1, minWidth: 80 }}
      onClick={canUpgrade ? onUpgrade : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: "0.1em" }}>{label}</span>
        <span
          className="text-xs px-1.5 py-0.5"
          style={{
            background: canUpgrade ? "rgba(255,215,0,0.15)" : "transparent",
            color: canUpgrade ? "#ffd700" : "rgba(255,255,255,0.15)",
            border: canUpgrade ? "1px solid rgba(255,215,0,0.3)" : "1px solid transparent",
            fontSize: 9,
            letterSpacing: "0.05em",
            transition: "all 0.2s",
          }}
        >
          [{keyHint}]
        </span>
      </div>
      <div style={{ color, fontSize: 14, fontWeight: "bold", letterSpacing: "0.05em", marginTop: 2 }}>{value}</div>
      {extra}
      {canUpgrade && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          style={{ background: "rgba(255,215,0,0.07)", pointerEvents: "none" }}
        >
          <span style={{ color: "#ffd700", fontSize: 18, fontWeight: "bold" }}>+</span>
        </div>
      )}
    </div>
  );
}

// ── ManaBar ───────────────────────────────────────────────────────────────────
function ManaBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, Math.min(1, current / max));
  return (
    <div style={{ marginTop: 4, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
      <div
        style={{
          height: "100%",
          width: `${pct * 100}%`,
          background: "linear-gradient(90deg, #4488ff, #88aaff)",
          borderRadius: 2,
          transition: "width 0.1s",
        }}
      />
    </div>
  );
}

// ── AbilityBlock ──────────────────────────────────────────────────────────────
function AbilityBlock({
  keyHint, name, abilityLevel, active, locked, color, canUpgrade, onUpgrade,
}: {
  keyHint: string; name: string; abilityLevel: number; active: boolean;
  locked: boolean; color: string; canUpgrade: boolean; onUpgrade: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center px-5 py-2 relative group"
      style={{ minWidth: 100 }}
    >
      {/* Key hint */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className="px-1.5 py-0.5 text-xs"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: locked ? "rgba(255,255,255,0.15)" : (active ? color : "rgba(255,255,255,0.4)"),
            border: `1px solid ${locked ? "rgba(255,255,255,0.06)" : (active ? color : "rgba(255,255,255,0.1)")}`,
            fontSize: 9,
            letterSpacing: "0.05em",
          }}
        >
          [{keyHint}]
        </span>
        <span style={{ color: locked ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: "0.1em" }}>
          {name}
        </span>
      </div>

      {/* Icon: ball */}
      <div
        className="rounded-full"
        style={{
          width: 20,
          height: 20,
          background: locked ? "rgba(255,255,255,0.05)" : (active ? color : `${color}55`),
          boxShadow: active ? `0 0 10px ${color}` : "none",
          border: locked ? "1px solid rgba(255,255,255,0.08)" : `1px solid ${color}66`,
          transition: "all 0.3s",
          marginBottom: 4,
        }}
      />

      {/* Level dots */}
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: 6,
              height: 6,
              background: i < abilityLevel ? "#ffd700" : "rgba(255,255,255,0.1)",
              boxShadow: i < abilityLevel ? "0 0 4px rgba(255,215,0,0.6)" : "none",
              transition: "all 0.3s",
            }}
          />
        ))}
      </div>

      {/* Locked label */}
      {locked && (
        <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 7, marginTop: 3, letterSpacing: "0.08em" }}>
          LOCKED
        </div>
      )}

      {/* Upgrade hint */}
      {canUpgrade && (
        <button
          onClick={onUpgrade}
          className="mt-1 text-xs px-2 py-0.5 transition-all"
          style={{
            background: "rgba(255,215,0,0.15)",
            color: "#ffd700",
            border: "1px solid rgba(255,215,0,0.3)",
            fontSize: 8,
            letterSpacing: "0.05em",
            cursor: "pointer",
          }}
        >
          ПРОКАЧАТЬ
        </button>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function blendToOrange(baseColor: string, level: number): string {
  // Blend from baseColor toward #ff8800 based on level (1-5)
  const t = level / 5;
  const num = parseInt(baseColor.replace("#", ""), 16);
  const r1 = (num >> 16) & 0xff;
  const g1 = (num >> 8) & 0xff;
  const b1 = num & 0xff;
  const r2 = 255, g2 = 136, b2 = 0;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}
