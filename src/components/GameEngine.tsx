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

// ── Level layout ──────────────────────────────────────────────────────────────
// Corridor: array of rooms, each room has balls and an exit on the right
// The corridor scrolls left as the player moves right

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
}

interface Room {
  width: number;   // in pixels
  height: number;  // corridor height
  balls: BallDef[];
}

interface BallDef {
  x: number; y: number; vx: number; vy: number; r: number;
}

function makeRoom(level: number): Room {
  const height = 220;
  const width = 800 + level * 60;
  const count = 3 + level * 2;
  const balls: BallDef[] = [];
  const speed = 1.5 + level * 0.4;
  for (let i = 0; i < count; i++) {
    const r = 10 + Math.random() * 8;
    balls.push({
      x: 150 + Math.random() * (width - 300),
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
const CORRIDOR_Y_OFFSET = 90; // top of corridor from canvas top
const CORRIDOR_H = 220;
const PLAYER_R = 12;
const EXIT_W = 30;
const EXIT_H = CORRIDOR_H;
const DEATH_DURATION = 60_000; // 60 seconds in ms

export default function GameEngine({ character, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    // player
    px: 80,
    py: CORRIDOR_Y_OFFSET + CORRIDOR_H / 2,
    vx: 0,
    vy: 0,
    // camera scroll
    camX: 0,
    // keys
    keys: {} as Record<string, boolean>,
    // balls (world-space)
    balls: [] as Ball[],
    // room
    room: null as Room | null,
    // status
    dead: false,
    deadAt: 0,
    level: 1,
    mana: 10,
    // frame
    frame: 0,
    lastTime: 0,
  });
  const [level, setLevel] = useState(1);
  const [dead, setDead] = useState(false);
  const [deadTimer, setDeadTimer] = useState(0); // ms remaining
  const [showLevelUp, setShowLevelUp] = useState(false);
  const animRef = useRef<number>(0);
  const deadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Init room ──────────────────────────────────────────────────────────────
  const initRoom = useCallback((lvl: number) => {
    const room = makeRoom(lvl);
    const s = stateRef.current;
    s.room = room;
    s.balls = room.balls.map((b, i) => ({
      ...b,
      id: i,
      color: "#888888",
    }));
    s.px = 80;
    s.py = CORRIDOR_Y_OFFSET + CORRIDOR_H / 2;
    s.camX = 0;
    s.dead = false;
    s.deadAt = 0;
    s.level = lvl;
  }, []);

  // ── Handle death countdown ─────────────────────────────────────────────────
  const startDeathTimer = useCallback(() => {
    if (deadIntervalRef.current) clearInterval(deadIntervalRef.current);
    const start = Date.now();
    setDeadTimer(DEATH_DURATION);
    deadIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = DEATH_DURATION - elapsed;
      if (remaining <= 0) {
        clearInterval(deadIntervalRef.current!);
        deadIntervalRef.current = null;
        // Game over — respawn at level 1
        setDead(false);
        setLevel(1);
        initRoom(1);
      } else {
        setDeadTimer(remaining);
      }
    }, 100);
  }, [initRoom]);

  // ── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    initRoom(1);

    const handleKey = (e: KeyboardEvent, down: boolean) => {
      stateRef.current.keys[e.key.toLowerCase()] = down;
      e.preventDefault();
    };
    window.addEventListener("keydown", (e) => handleKey(e, true));
    window.addEventListener("keyup", (e) => handleKey(e, false));

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 3); // normalized to ~60fps
      lastTime = now;
      const s = stateRef.current;
      const room = s.room!;

      // ── Move balls ──
      for (const b of s.balls) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        // bounce off corridor walls (world space)
        const top = CORRIDOR_Y_OFFSET + b.r;
        const bot = CORRIDOR_Y_OFFSET + CORRIDOR_H - b.r;
        const left = b.r;
        const right = room.width + b.r;
        if (b.y < top) { b.y = top; b.vy = Math.abs(b.vy); }
        if (b.y > bot) { b.y = bot; b.vy = -Math.abs(b.vy); }
        if (b.x < left) { b.x = left; b.vx = Math.abs(b.vx); }
        if (b.x > right) { b.x = right; b.vx = -Math.abs(b.vx); }
      }

      if (!s.dead) {
        // ── Move player ──
        const spd = character.stats.speed * 1.5;
        let dvx = 0, dvy = 0;
        if (s.keys["w"] || s.keys["arrowup"]) dvy = -1;
        if (s.keys["s"] || s.keys["arrowdown"]) dvy = 1;
        if (s.keys["a"] || s.keys["arrowleft"]) dvx = -1;
        if (s.keys["d"] || s.keys["arrowright"]) dvx = 1;
        // normalize diagonal
        if (dvx !== 0 && dvy !== 0) { dvx *= 0.707; dvy *= 0.707; }
        s.vx += (dvx * spd - s.vx) * 0.25;
        s.vy += (dvy * spd - s.vy) * 0.25;
        s.px += s.vx * dt;
        s.py += s.vy * dt;

        // ── Clamp player to corridor ──
        s.py = Math.max(CORRIDOR_Y_OFFSET + PLAYER_R, Math.min(CORRIDOR_Y_OFFSET + CORRIDOR_H - PLAYER_R, s.py));
        // left wall
        if (s.px < PLAYER_R) { s.px = PLAYER_R; s.vx = 0; }

        // ── Camera ──
        const targetCamX = s.px - CANVAS_W * 0.35;
        s.camX += (targetCamX - s.camX) * 0.08 * dt;
        if (s.camX < 0) s.camX = 0;

        // ── Check ball collision ──
        for (const b of s.balls) {
          const wx = b.x - s.camX; // screen x of ball
          const bScreenX = b.x - s.camX;
          const bScreenY = b.y;
          const dx = bScreenX - s.px;
          const dy = bScreenY - s.py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < b.r + PLAYER_R) {
            s.dead = true;
            s.deadAt = Date.now();
            setDead(true);
            startDeathTimer();
            break;
          }
          void wx;
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
        }
      }

      // ── Draw ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // BG
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

      // ── Corridor walls ──
      const corrTop = CORRIDOR_Y_OFFSET;
      const corrBot = CORRIDOR_Y_OFFSET + CORRIDOR_H;

      // Dark zones outside corridor
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, CANVAS_W, corrTop);
      ctx.fillRect(0, corrBot, CANVAS_W, CANVAS_H - corrBot);

      // Wall lines
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, corrTop); ctx.lineTo(CANVAS_W, corrTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, corrBot); ctx.lineTo(CANVAS_W, corrBot); ctx.stroke();

      // ── Exit portal ──
      const exitSX = room.width - s.camX;
      if (exitSX > 0 && exitSX < CANVAS_W + EXIT_W) {
        // Yellow glow
        const grad = ctx.createLinearGradient(exitSX - EXIT_W, corrTop, exitSX, corrTop);
        grad.addColorStop(0, "rgba(255,220,0,0)");
        grad.addColorStop(1, "rgba(255,220,0,0.35)");
        ctx.fillStyle = grad;
        ctx.fillRect(exitSX - EXIT_W, corrTop, EXIT_W, CORRIDOR_H);
        // Edge line
        ctx.strokeStyle = "rgba(255,220,0,0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(exitSX, corrTop); ctx.lineTo(exitSX, corrBot); ctx.stroke();
        // Shimmer
        const t = performance.now() / 1000;
        ctx.strokeStyle = `rgba(255,240,80,${0.3 + 0.3 * Math.sin(t * 3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(exitSX - 4, corrTop); ctx.lineTo(exitSX - 4, corrBot); ctx.stroke();
      }

      // Distance label on top
      const distToExit = Math.max(0, Math.round(room.width - s.px));
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
        // Glow
        const bglow = ctx.createRadialGradient(bx, by, 0, bx, by, b.r * 2.5);
        bglow.addColorStop(0, "rgba(160,160,160,0.2)");
        bglow.addColorStop(1, "rgba(160,160,160,0)");
        ctx.fillStyle = bglow;
        ctx.beginPath();
        ctx.arc(bx, by, b.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Ball
        const ballGrad = ctx.createRadialGradient(bx - b.r * 0.3, by - b.r * 0.3, 0, bx, by, b.r);
        ballGrad.addColorStop(0, "#cccccc");
        ballGrad.addColorStop(1, "#555555");
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(bx, by, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── Player ──
      if (!s.dead) {
        const px = s.px;
        const py = s.py;

        // Glow
        ctx.save();
        const pglow = ctx.createRadialGradient(px, py, 0, px, py, PLAYER_R * 3);
        pglow.addColorStop(0, character.glow);
        pglow.addColorStop(1, "transparent");
        ctx.fillStyle = pglow;
        ctx.beginPath();
        ctx.arc(px, py, PLAYER_R * 3, 0, Math.PI * 2);
        ctx.fill();

        // Player circle
        const pgrad = ctx.createRadialGradient(px - PLAYER_R * 0.3, py - PLAYER_R * 0.3, 0, px, py, PLAYER_R);
        pgrad.addColorStop(0, lighten(character.color, 40));
        pgrad.addColorStop(1, character.color);
        ctx.fillStyle = pgrad;
        ctx.beginPath();
        ctx.arc(px, py, PLAYER_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Dead — draw X
        const px = s.px;
        const py = s.py;
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() / 200);
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

      // ── HUD ──
      drawHUD(ctx, s.level, s.dead, character);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("keydown", (e) => handleKey(e, true));
      window.removeEventListener("keyup", (e) => handleKey(e, false));
      if (deadIntervalRef.current) clearInterval(deadIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            УРОВЕНЬ{" "}
            <span style={{ color: "#fff", fontSize: 16 }}>{level}</span>
          </div>
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: character.color, boxShadow: `0 0 8px ${character.glow}` }}
          />
          <span className="text-xs tracking-widest" style={{ color: character.color }}>
            {character.name}
          </span>
        </div>
      </div>

      {/* Canvas wrapper */}
      <div className="relative" style={{ width: CANVAS_W, border: "1px solid rgba(255,255,255,0.07)" }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: "block", cursor: "none" }}
        />

        {/* Death overlay */}
        {dead && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(2px)" }}
          >
            <div
              className="text-4xl font-black tracking-widest"
              style={{ color: character.color, textShadow: `0 0 30px ${character.glow}` }}
            >
              ТЫ УПАЛ
            </div>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              жди союзника · осталось{" "}
              <span style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                {Math.ceil(deadTimer / 1000)}с
              </span>
            </div>
            <div
              className="text-xs tracking-widest mt-2"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              (в одиночной игре — автоподъём через минуту)
            </div>
          </div>
        )}

        {/* Level up popup */}
        {showLevelUp && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              className="text-5xl font-black tracking-widest animate-slide-up"
              style={{
                color: "#ffd700",
                textShadow: "0 0 40px rgba(255,215,0,0.8)",
              }}
            >
              УРОВЕНЬ {level}
            </div>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <div
        className="mt-4 text-xs tracking-[0.3em] uppercase"
        style={{ color: "rgba(255,255,255,0.12)" }}
      >
        WASD — движение · Доберись до жёлтого выхода
      </div>
    </div>
  );
}

// ── HUD drawing ──────────────────────────────────────────────────────────────
function drawHUD(
  ctx: CanvasRenderingContext2D,
  level: number,
  dead: boolean,
  character: CharDef
) {
  ctx.save();
  ctx.font = "bold 13px 'Oswald', sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText(`LVL ${level}`, 16, 26);

  if (dead) {
    ctx.fillStyle = "rgba(255,80,80,0.8)";
    ctx.font = "bold 12px 'Oswald', sans-serif";
    ctx.fillText("УПАЛ", 16, 46);
  }
  ctx.restore();
  void character;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}
