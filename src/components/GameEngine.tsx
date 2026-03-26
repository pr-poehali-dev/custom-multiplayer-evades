import { useEffect, useRef, useState, useCallback } from "react";

interface CharDef {
  id: string; name: string; color: string; glow: string;
  stats: { speed: number; manaMax: number; manaRegen: number };
}
interface Props { character: CharDef; onBack: () => void; }

interface Ball { id: number; x: number; y: number; vx: number; vy: number; r: number; }
interface Room { width: number; }

const SAFE_ZONE = 200;
const CORRIDOR_H = 110; // ~half of previous 220
const CANVAS_W = 900;
const CANVAS_H = 400;
const CORRIDOR_TOP = (CANVAS_H - CORRIDOR_H) / 2;
const PLAYER_R = 10;
const BALL_R = 10;
const EXIT_W = 28;
const SPEED_SCALE = 0.22;

// Minimap constants
const MM_W = 140, MM_H = 32, MM_X = 12, MM_Y = CANVAS_H - 12 - MM_H;

function makeRoom(level: number): Room {
  return { width: 1800 + level * 250 };
}

function makeBalls(room: Room, level: number): Ball[] {
  const count = 3 + level * 2;
  const speed = 0.7 + level * 0.18;
  const balls: Ball[] = [];
  for (let i = 0; i < count; i++) {
    const minX = SAFE_ZONE + BALL_R;
    const maxX = room.width - SAFE_ZONE - BALL_R;
    balls.push({
      id: i,
      x: minX + Math.random() * (maxX - minX),
      y: BALL_R + Math.random() * (CORRIDOR_H - BALL_R * 2),
      vx: (Math.random() > 0.5 ? 1 : -1) * (speed + Math.random() * speed * 0.4),
      vy: (Math.random() > 0.5 ? 1 : -1) * (speed * 0.7 + Math.random() * speed * 0.3),
      r: BALL_R,
    });
  }
  return balls;
}

interface AbilityState { id: string; level: number; active: boolean; }
interface PlayerStats {
  speedBase: number; manaMax: number; manaRegen: number;
  mana: number; skillPoints: number; abilities: AbilityState[];
}

function defaultStats(char: CharDef): PlayerStats {
  return {
    speedBase: char.stats.speed, manaMax: char.stats.manaMax,
    manaRegen: 1, mana: char.stats.manaMax, skillPoints: 0,
    abilities: [{ id: "boost", level: 0, active: false }],
  };
}

function boostSpeedBonus(lvl: number): number { return lvl > 0 ? 1 + lvl : 0; }

export default function GameEngine({ character, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(1);
  const [dead, setDead] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [stats, setStats] = useState<PlayerStats>(() => defaultStats(character));

  const s = useRef({
    px: 80, py: CORRIDOR_H / 2, vx: 0, vy: 0,
    // camera world-X that maps to CANVAS_W/2
    // clamped so world left ≥ 0 and world right ≤ room.width
    camX: CANVAS_W / 2,
    keys: {} as Record<string, boolean>,
    balls: [] as Ball[],
    room: null as Room | null,
    dead: false, level: 1,
    speedBase: character.stats.speed, manaMax: character.stats.manaMax,
    manaRegen: 1, mana: character.stats.manaMax, skillPoints: 0,
    abilities: [{ id: "boost", level: 0, active: false }] as AbilityState[],
    lastManaTime: 0, lastAbilityManaTime: 0, frame: 0,
  });

  const animRef = useRef<number>(0);

  useEffect(() => {
    const st = s.current;
    st.speedBase = stats.speedBase; st.manaMax = stats.manaMax;
    st.manaRegen = stats.manaRegen; st.skillPoints = stats.skillPoints;
    st.abilities = stats.abilities.map(a => ({
      ...a, active: st.abilities.find(x => x.id === a.id)?.active ?? a.active,
    }));
  }, [stats]);

  const initRoom = useCallback((lvl: number) => {
    const room = makeRoom(lvl);
    const st = s.current;
    st.room = room; st.balls = makeBalls(room, lvl);
    st.px = 80; st.py = CORRIDOR_H / 2; st.vx = 0; st.vy = 0;
    // camera starts so that player (px=80) is at center, clamped to left wall
    st.camX = Math.max(CANVAS_W / 2, 80);
    st.dead = false; st.level = lvl;
    for (const a of st.abilities) a.active = false;
  }, []);

  const upgradeRef = useRef<(what: string) => void>(() => {});
  useEffect(() => {
    upgradeRef.current = (what: string) => {
      setStats(prev => {
        if (prev.skillPoints <= 0) return prev;
        const st = s.current;
        switch (what) {
          case "1": { const ns = { ...prev, speedBase: Math.round((prev.speedBase + 0.5) * 100) / 100, skillPoints: prev.skillPoints - 1 }; st.speedBase = ns.speedBase; st.skillPoints = ns.skillPoints; return ns; }
          case "2": { const ns = { ...prev, manaMax: prev.manaMax + 5, skillPoints: prev.skillPoints - 1 }; st.manaMax = ns.manaMax; st.skillPoints = ns.skillPoints; return ns; }
          case "3": { const ns = { ...prev, manaRegen: Math.round((prev.manaRegen + 0.2) * 100) / 100, skillPoints: prev.skillPoints - 1 }; st.manaRegen = ns.manaRegen; st.skillPoints = ns.skillPoints; return ns; }
          case "4u": {
            const ab = prev.abilities.find(a => a.id === "boost")!;
            if (ab.level >= 5) return prev;
            const newAb = prev.abilities.map(a => a.id === "boost" ? { ...a, level: a.level + 1 } : a);
            const ns = { ...prev, abilities: newAb, skillPoints: prev.skillPoints - 1 };
            st.abilities = newAb.map(x => ({ ...x, active: st.abilities.find(y => y.id === x.id)?.active ?? false }));
            st.skillPoints = ns.skillPoints;
            return ns;
          }
          default: return prev;
        }
      });
    };
  });

  useEffect(() => {
    initRoom(1);
    s.current.lastManaTime = performance.now();
    s.current.lastAbilityManaTime = performance.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Use e.code for layout-independent WASD
      const code = e.code;
      s.current.keys[code] = true;

      if (e.key === "1") upgradeRef.current("1");
      if (e.key === "2") upgradeRef.current("2");
      if (e.key === "3") upgradeRef.current("3");
      if (e.key === "4") {
        const st = s.current;
        const boost = st.abilities.find(a => a.id === "boost")!;
        if (boost.level > 0) {
          boost.active = !boost.active;
          const active = boost.active;
          if (active) st.lastAbilityManaTime = performance.now();
          setStats(prev => ({ ...prev, abilities: prev.abilities.map(a => a.id === "boost" ? { ...a, active } : a) }));
        } else {
          upgradeRef.current("4u");
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      s.current.keys[e.code] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;
      const st = s.current;
      const room = st.room!;

      // Mana regen
      const me = (now - st.lastManaTime) / 1000;
      if (me >= 0.05) { st.mana = Math.min(st.manaMax, st.mana + st.manaRegen * me); st.lastManaTime = now; }

      // Boost drain
      const boost = st.abilities.find(a => a.id === "boost")!;
      if (boost.active) {
        const ae = (now - st.lastAbilityManaTime) / 1000;
        if (ae >= 0.05) {
          st.mana = Math.max(0, st.mana - 2 * ae);
          st.lastAbilityManaTime = now;
          if (st.mana <= 0) {
            boost.active = false;
            setStats(prev => ({ ...prev, abilities: prev.abilities.map(a => a.id === "boost" ? { ...a, active: false } : a) }));
          }
        }
      } else { st.lastAbilityManaTime = now; }

      // Move balls (world space, bounce between safe zone walls)
      for (const b of st.balls) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
        if (b.y > CORRIDOR_H - b.r) { b.y = CORRIDOR_H - b.r; b.vy = -Math.abs(b.vy); }
        if (b.x < SAFE_ZONE + b.r) { b.x = SAFE_ZONE + b.r; b.vx = Math.abs(b.vx); }
        if (b.x > room.width - SAFE_ZONE - b.r) { b.x = room.width - SAFE_ZONE - b.r; b.vx = -Math.abs(b.vx); }
      }

      if (!st.dead) {
        // Player movement (e.code based — layout independent)
        const slow = st.keys["ShiftLeft"] || st.keys["ShiftRight"] ? 1 / 3 : 1;
        const boostBonus = boost.active ? boostSpeedBonus(boost.level) : 0;
        const totalSpeed = (st.speedBase + boostBonus) * SPEED_SCALE * slow;
        let dvx = 0, dvy = 0;
        if (st.keys["KeyW"]) dvy = -1;
        if (st.keys["KeyS"]) dvy = 1;
        if (st.keys["KeyA"]) dvx = -1;
        if (st.keys["KeyD"]) dvx = 1;
        if (dvx !== 0 && dvy !== 0) { dvx *= 0.707; dvy *= 0.707; }
        st.vx += (dvx * totalSpeed - st.vx) * 0.18;
        st.vy += (dvy * totalSpeed - st.vy) * 0.18;
        st.px += st.vx * dt;
        st.py += st.vy * dt;

        st.py = Math.max(PLAYER_R, Math.min(CORRIDOR_H - PLAYER_R, st.py));
        if (st.px < PLAYER_R) { st.px = PLAYER_R; st.vx = 0; }
        if (st.px > room.width - PLAYER_R) { st.px = room.width - PLAYER_R; st.vx = 0; }

        // Camera: player at center, clamped so world edges don't go past canvas edges
        const idealCam = st.px;
        const minCam = CANVAS_W / 2;            // left wall: world x=0 at canvas x=0
        const maxCam = room.width - CANVAS_W / 2; // right wall: world x=room.width at canvas x=CANVAS_W
        st.camX = Math.max(minCam, Math.min(maxCam > minCam ? maxCam : minCam, idealCam));

        // Collision (world space)
        for (const b of st.balls) {
          const dx = b.x - st.px, dy = b.y - st.py;
          if (Math.sqrt(dx * dx + dy * dy) < b.r + PLAYER_R) {
            st.dead = true; boost.active = false;
            setDead(true);
            setStats(prev => ({ ...prev, abilities: prev.abilities.map(a => ({ ...a, active: false })) }));
            break;
          }
        }

        // Exit check
        if (st.px >= room.width - PLAYER_R - 4) {
          const nl = st.level + 1;
          st.level = nl; st.skillPoints += 1;
          setLevel(nl); setShowLevelUp(true);
          setTimeout(() => setShowLevelUp(false), 1500);
          initRoom(nl);
          setStats(prev => ({ ...prev, skillPoints: prev.skillPoints + 1 }));
        }
      }

      // ── Render ──────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#0d0d0f";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // camOffsetX: add to world X to get screen X
      const camOffsetX = CANVAS_W / 2 - st.camX;

      // Grid (infinite, no clamp)
      ctx.strokeStyle = "rgba(255,255,255,0.025)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = ((camOffsetX % gridSize) + gridSize) % gridSize; x < CANVAS_W; x += gridSize) {
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

      // ── Left wall of world (world x=0) ──
      const worldLeftSX = 0 + camOffsetX;
      if (worldLeftSX > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(0, corrTop, worldLeftSX, CORRIDOR_H);
      }
      // ── Right wall of world (world x=room.width) ──
      const worldRightSX = room.width + camOffsetX;
      if (worldRightSX < CANVAS_W) {
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(worldRightSX, corrTop, CANVAS_W - worldRightSX, CORRIDOR_H);
      }

      // ── Safe zones ──
      // Start safe zone: world [0, SAFE_ZONE] — draw only the visible portion
      const safeStartWorld = 0;
      const safeStartEnd = SAFE_ZONE;
      const ssSX = safeStartWorld + camOffsetX;
      const ssEX = safeStartEnd + camOffsetX;
      if (ssEX > 0 && ssSX < CANVAS_W) {
        const drawX = Math.max(0, ssSX);
        const drawW = Math.min(ssEX, CANVAS_W) - drawX;
        if (drawW > 0) {
          ctx.fillStyle = "rgba(80,120,200,0.07)";
          ctx.fillRect(drawX, corrTop, drawW, CORRIDOR_H);
        }
        // Dashed border line at world x = SAFE_ZONE
        if (ssEX > 0 && ssEX < CANVAS_W) {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "rgba(100,150,255,0.25)";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(ssEX, corrTop); ctx.lineTo(ssEX, corrBot); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // End safe zone: world [room.width - SAFE_ZONE, room.width]
      const safeEndStart = room.width - SAFE_ZONE;
      const seSX = safeEndStart + camOffsetX;
      const seEX = room.width + camOffsetX;
      if (seEX > 0 && seSX < CANVAS_W) {
        const drawX = Math.max(0, seSX);
        const drawW = Math.min(seEX, CANVAS_W) - drawX;
        if (drawW > 0) {
          ctx.fillStyle = "rgba(80,120,200,0.07)";
          ctx.fillRect(drawX, corrTop, drawW, CORRIDOR_H);
        }
        if (seSX > 0 && seSX < CANVAS_W) {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "rgba(100,150,255,0.25)";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(seSX, corrTop); ctx.lineTo(seSX, corrBot); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Corridor wall lines
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, corrTop); ctx.lineTo(CANVAS_W, corrTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, corrBot); ctx.lineTo(CANVAS_W, corrBot); ctx.stroke();

      // ── Exit portal ──
      const exitSX = room.width + camOffsetX;
      if (exitSX > 0 && exitSX < CANVAS_W + EXIT_W) {
        const grad = ctx.createLinearGradient(exitSX - EXIT_W, corrTop, exitSX, corrTop);
        grad.addColorStop(0, "rgba(255,220,0,0)");
        grad.addColorStop(1, "rgba(255,220,0,0.4)");
        ctx.fillStyle = grad;
        ctx.fillRect(exitSX - EXIT_W, corrTop, EXIT_W, CORRIDOR_H);
        ctx.strokeStyle = "rgba(255,220,0,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(exitSX, corrTop); ctx.lineTo(exitSX, corrBot); ctx.stroke();
        const t = now / 1000;
        ctx.strokeStyle = `rgba(255,240,80,${0.3 + 0.3 * Math.sin(t * 3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(exitSX - 4, corrTop); ctx.lineTo(exitSX - 4, corrBot); ctx.stroke();
      }

      // Distance label
      const distToExit = Math.max(0, Math.round(room.width - st.px));
      ctx.fillStyle = "rgba(255,220,0,0.5)";
      ctx.font = "11px 'Oswald', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`выход: ${distToExit}px`, CANVAS_W - 16, corrTop - 10);

      // ── Balls ──
      for (const b of st.balls) {
        const bsx = b.x + camOffsetX;
        const bsy = b.y + corrTop;
        if (bsx < -b.r * 2 || bsx > CANVAS_W + b.r * 2) continue;
        ctx.save();
        const bglow = ctx.createRadialGradient(bsx, bsy, 0, bsx, bsy, b.r * 2.5);
        bglow.addColorStop(0, "rgba(160,160,160,0.15)"); bglow.addColorStop(1, "rgba(160,160,160,0)");
        ctx.fillStyle = bglow; ctx.beginPath(); ctx.arc(bsx, bsy, b.r * 2.5, 0, Math.PI * 2); ctx.fill();
        const bg2 = ctx.createRadialGradient(bsx - b.r * 0.3, bsy - b.r * 0.3, 0, bsx, bsy, b.r);
        bg2.addColorStop(0, "#cccccc"); bg2.addColorStop(1, "#555555");
        ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(bsx, bsy, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // ── Player ──
      const psx = st.px + camOffsetX;
      const psy = st.py + corrTop;
      const boostActive = boost.active;
      const playerColor = boostActive ? blendToOrange(character.color, boost.level) : character.color;
      const playerGlow = boostActive ? "rgba(255,140,0,0.7)" : character.glow;

      if (!st.dead) {
        ctx.save();
        const pg = ctx.createRadialGradient(psx, psy, 0, psx, psy, PLAYER_R * 3);
        pg.addColorStop(0, playerGlow); pg.addColorStop(1, "transparent");
        ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(psx, psy, PLAYER_R * 3, 0, Math.PI * 2); ctx.fill();
        const pg2 = ctx.createRadialGradient(psx - PLAYER_R * 0.3, psy - PLAYER_R * 0.3, 0, psx, psy, PLAYER_R);
        pg2.addColorStop(0, lighten(playerColor, 40)); pg2.addColorStop(1, playerColor);
        ctx.fillStyle = pg2; ctx.beginPath(); ctx.arc(psx, psy, PLAYER_R, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.save(); ctx.globalAlpha = 0.4 + 0.2 * Math.sin(now / 200);
        ctx.strokeStyle = character.color; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(psx - PLAYER_R, psy - PLAYER_R); ctx.lineTo(psx + PLAYER_R, psy + PLAYER_R);
        ctx.moveTo(psx + PLAYER_R, psy - PLAYER_R); ctx.lineTo(psx - PLAYER_R, psy + PLAYER_R);
        ctx.stroke(); ctx.restore();
      }

      // ── Minimap ──
      const mmPad = 2;
      ctx.save();
      // Background
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(MM_X, MM_Y, MM_W, MM_H);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.strokeRect(MM_X, MM_Y, MM_W, MM_H);

      const mmInnerW = MM_W - mmPad * 2;
      const mmInnerH = MM_H - mmPad * 2;
      const scaleX = mmInnerW / room.width;
      const scaleY = mmInnerH / CORRIDOR_H;

      // Safe zones on minimap
      ctx.fillStyle = "rgba(80,120,200,0.15)";
      ctx.fillRect(MM_X + mmPad, MM_Y + mmPad, SAFE_ZONE * scaleX, mmInnerH);
      ctx.fillRect(MM_X + mmPad + (room.width - SAFE_ZONE) * scaleX, MM_Y + mmPad, SAFE_ZONE * scaleX, mmInnerH);

      // Balls on minimap
      for (const b of st.balls) {
        ctx.fillStyle = "#888";
        ctx.beginPath();
        ctx.arc(MM_X + mmPad + b.x * scaleX, MM_Y + mmPad + b.y * scaleY, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Exit on minimap
      ctx.fillStyle = "rgba(255,220,0,0.7)";
      ctx.fillRect(MM_X + mmPad + (room.width - 4) * scaleX, MM_Y + mmPad, 3, mmInnerH);

      // Player on minimap
      ctx.fillStyle = character.color;
      ctx.beginPath();
      ctx.arc(MM_X + mmPad + st.px * scaleX, MM_Y + mmPad + st.py * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Sync mana
      if (st.frame % 6 === 0) {
        const lm = st.mana;
        setStats(prev => prev.mana === lm ? prev : { ...prev, mana: lm });
      }
      st.frame++;
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
        <button onClick={onBack} className="text-xs tracking-widest uppercase"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >← назад</button>
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
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display: "block" }} />

        {dead && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "rgba(0,0,0,0.55)" }}>
            <div className="text-4xl font-black tracking-widest" style={{ color: character.color, textShadow: `0 0 30px ${character.glow}` }}>ТЫ ПОГИБ</div>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>сольный режим — конец игры</div>
            <button
              onClick={() => {
                setDead(false); setLevel(1);
                const fresh = defaultStats(character);
                setStats(fresh);
                const st = s.current;
                st.mana = fresh.mana; st.speedBase = fresh.speedBase; st.manaMax = fresh.manaMax;
                st.manaRegen = fresh.manaRegen; st.skillPoints = 0;
                st.abilities = fresh.abilities.map(a => ({ ...a }));
                initRoom(1);
              }}
              className="mt-3 px-10 py-2 text-sm font-bold tracking-[0.3em] uppercase"
              style={{ background: "rgba(255,255,255,0.9)", color: "#0d0d0f", cursor: "pointer" }}
            >НАЧАТЬ ЗАНОВО</button>
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

      {/* HUD */}
      <div className="flex items-stretch gap-0 w-full"
        style={{ maxWidth: CANVAS_W, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderTop: "none" }}
      >
        {/* Skill points */}
        <div className="flex flex-col items-center justify-center px-4 py-2" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", minWidth: 64 }}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <div className="rounded-full" style={{
              width: 22, height: 22,
              background: stats.skillPoints > 0 ? "#ffd700" : "rgba(255,215,0,0.15)",
              boxShadow: stats.skillPoints > 0 ? "0 0 12px rgba(255,215,0,0.8)" : "none",
              transition: "all 0.3s",
            }} />
            {stats.skillPoints > 0 && (
              <span style={{ position: "absolute", top: -6, right: -6, background: "#ffd700", color: "#0d0d0f", borderRadius: "50%", width: 14, height: 14, fontSize: 9, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {stats.skillPoints}
              </span>
            )}
          </div>
          <span style={{ color: "rgba(255,215,0,0.4)", fontSize: 8, marginTop: 3, letterSpacing: "0.05em" }}>ОЧКИ</span>
        </div>

        <StatBlock label="СКОРОСТЬ" value={`${stats.speedBase.toFixed(1)}`} keyHint="1" color="#aabbff" active={stats.skillPoints > 0} />
        <StatBlock
          label="МАКС МАНА"
          value={`${Math.floor(stats.mana)} \\ ${stats.manaMax}`}
          keyHint="2" color="#88aaff" active={stats.skillPoints > 0}
          extra={<ManaBar current={stats.mana} max={stats.manaMax} />}
        />
        <StatBlock label="РЕГЕН МАНЫ" value={`${stats.manaRegen.toFixed(1)}/с`} keyHint="3" color="#66aaee" active={stats.skillPoints > 0} />

        <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />

        <AbilityBlock
          keyHint="4" name="УСКОРЕНИЕ"
          abilityLevel={boostAbility.level} active={boostAbility.active}
          locked={boostAbility.level === 0}
          color={boostAbility.active ? "#ff9900" : "#ff4444"}
          canUpgrade={stats.skillPoints > 0 && boostAbility.level < 5}
        />
      </div>

      <div className="mt-3 text-xs tracking-[0.25em] uppercase" style={{ color: "rgba(255,255,255,0.1)" }}>
        WASD — движение · SHIFT — медленно · 1/2/3 — прокачка · 4 — ускорение
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
        <span style={{ background: active ? "rgba(255,215,0,0.15)" : "transparent", color: active ? "#ffd700" : "rgba(255,255,255,0.15)", border: active ? "1px solid rgba(255,215,0,0.3)" : "1px solid transparent", fontSize: 9, padding: "1px 4px" }}>
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
      <div style={{ height: "100%", width: `${pct * 100}%`, background: "linear-gradient(90deg,#4488ff,#88aaff)", borderRadius: 2, transition: "width 0.08s" }} />
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
        <span style={{ background: "rgba(255,255,255,0.05)", color: locked ? "rgba(255,255,255,0.15)" : (active ? color : "rgba(255,255,255,0.4)"), border: `1px solid ${locked ? "rgba(255,255,255,0.06)" : (active ? color : "rgba(255,255,255,0.1)")}`, fontSize: 9, padding: "1px 4px" }}>
          [{keyHint}]
        </span>
        <span style={{ color: locked ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: "0.1em" }}>{name}</span>
      </div>
      <div className="rounded-full" style={{ width: 20, height: 20, marginBottom: 4, background: locked ? "rgba(255,255,255,0.05)" : (active ? color : `${color}55`), boxShadow: active ? `0 0 10px ${color}` : "none", border: locked ? "1px solid rgba(255,255,255,0.08)" : `1px solid ${color}66`, transition: "all 0.3s" }} />
      <div className="flex gap-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="rounded-full" style={{ width: 6, height: 6, background: i < abilityLevel ? "#ffd700" : "rgba(255,255,255,0.1)", boxShadow: i < abilityLevel ? "0 0 4px rgba(255,215,0,0.6)" : "none", transition: "all 0.3s" }} />
        ))}
      </div>
      {locked && canUpgrade && <div style={{ color: "#ffd700", fontSize: 7, marginTop: 3 }}>НАЖМИ [4]</div>}
      {locked && !canUpgrade && <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 7, marginTop: 3 }}>LOCKED</div>}
    </div>
  );
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#",""), 16);
  return `rgb(${Math.min(255,(n>>16)+amount)},${Math.min(255,((n>>8)&0xff)+amount)},${Math.min(255,(n&0xff)+amount)})`;
}
function blendToOrange(base: string, level: number): string {
  const t = level / 5;
  const n = parseInt(base.replace("#",""), 16);
  return `rgb(${Math.round(((n>>16)&0xff)+(255-((n>>16)&0xff))*t)},${Math.round((((n>>8)&0xff))+(136-((n>>8)&0xff))*t)},${Math.round((n&0xff)*(1-t))})`;
}
