import React, { useEffect, useRef, useState, useCallback } from "react";

const ROOMS_URL = "https://functions.poehali.dev/2defc3c7-a0de-4530-b005-9363bbfb56f3";

interface CharDef {
  id: string; name: string; color: string; glow: string;
  stats: { speed: number; manaMax: number; manaRegen: number };
  abilities: CharAbilityDef[];
}
interface CharAbilityDef {
  id: string; name: string; keyUpgrade: string; keyUse: string;
  desc: string; color: string;
}
interface RemotePlayer { player_id: string; char_name: string; char_color: string; px: number; py: number; dead: boolean; }
interface Props { character: CharDef; onBack: () => void; roomCode?: string; playerId?: string; }

interface Ball { id: number; x: number; y: number; vx: number; vy: number; r: number; }
interface Room { width: number; }

const SAFE_ZONE = 200;
const CORRIDOR_H = 220;
const CANVAS_W = 900;
const CANVAS_H = 400;
const CORRIDOR_TOP = (CANVAS_H - CORRIDOR_H) / 2;
const PLAYER_R = 10;
const BALL_R = 10;
const EXIT_W = 28;
const SPEED_SCALE = 0.22;
const MANA_REGEN_MAX = 7;
const MM_W = 140, MM_H = 32, MM_X = 12, MM_Y = CANVAS_H - 12 - MM_H;
const TELEPORT_MAX_DIST = 200;

function makeRoom(lvl: number): Room { return { width: 1800 + lvl * 250 }; }

function makeBalls(room: Room, lvl: number): Ball[] {
  const count = 3 + lvl * 2;
  const speed = 0.7 + lvl * 0.18;
  const balls: Ball[] = [];
  for (let i = 0; i < count; i++) {
    const minX = SAFE_ZONE + BALL_R, maxX = room.width - SAFE_ZONE - BALL_R;
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
  const abilities = char.abilities.map(a => ({ id: a.id, level: 0, active: false }));
  return { speedBase: char.stats.speed, manaMax: char.stats.manaMax, manaRegen: 1, mana: char.stats.manaMax, skillPoints: 0, abilities };
}

function boostSpeedBonus(lvl: number): number { return lvl > 0 ? 1 + lvl : 0; }

export default function GameEngine({ character, onBack, roomCode, playerId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(1);
  const [dead, setDead] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [stats, setStats] = useState<PlayerStats>(() => defaultStats(character));
  const [timeFrozen, setTimeFrozen] = useState(false);
  const [cooldownsUI, setCooldownsUI] = useState<Record<string, number>>({});
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const remotePlayersRef = useRef<RemotePlayer[]>([]);
  const mpPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const st = useRef({
    px: 80, py: CORRIDOR_H / 2, vx: 0, vy: 0,
    camX: CANVAS_W / 2,
    keys: {} as Record<string, boolean>,
    mouseX: 0, mouseY: 0,
    balls: [] as Ball[],
    room: null as Room | null,
    dead: false, level: 1,
    speedBase: character.stats.speed, manaMax: character.stats.manaMax,
    manaRegen: 1, mana: character.stats.manaMax, skillPoints: 0,
    abilities: character.abilities.map(a => ({ id: a.id, level: 0, active: false })) as AbilityState[],
    lastManaTime: 0,
    abilityTimers: {} as Record<string, number>,
    timeFrozen: false,
    timeFreezeEnd: 0,
    frame: 0,
    cooldowns: {} as Record<string, number>,  // key=abilityId, value=timestamp when cooldown ends (ms)
  });

  const animRef = useRef<number>(0);

  useEffect(() => {
    const g = st.current;
    g.speedBase = stats.speedBase; g.manaMax = stats.manaMax;
    g.manaRegen = stats.manaRegen; g.skillPoints = stats.skillPoints;
    g.abilities = stats.abilities.map(a => ({ ...a, active: g.abilities.find(x => x.id === a.id)?.active ?? a.active }));
  }, [stats]);

  const initRoom = useCallback((lvl: number) => {
    const room = makeRoom(lvl);
    const g = st.current;
    g.room = room; g.balls = makeBalls(room, lvl);
    g.px = 80; g.py = CORRIDOR_H / 2; g.vx = 0; g.vy = 0;
    g.camX = Math.max(CANVAS_W / 2, 80);
    g.dead = false; g.level = lvl; g.timeFrozen = false;
    g.cooldowns = {};
    for (const a of g.abilities) a.active = false;
  }, []);

  const upgradeRef = useRef<(what: string) => void>(() => {});
  useEffect(() => {
    upgradeRef.current = (what: string) => {
      setStats(prev => {
        if (prev.skillPoints <= 0) return prev;
        const g = st.current;
        switch (what) {
          case "1": { const ns = { ...prev, speedBase: Math.round((prev.speedBase + 0.5) * 100) / 100, skillPoints: prev.skillPoints - 1 }; g.speedBase = ns.speedBase; g.skillPoints = ns.skillPoints; return ns; }
          case "2": { const ns = { ...prev, manaMax: prev.manaMax + 5, skillPoints: prev.skillPoints - 1 }; g.manaMax = ns.manaMax; g.skillPoints = ns.skillPoints; return ns; }
          case "3": {
            if (prev.manaRegen >= MANA_REGEN_MAX) return prev;
            const newRegen = Math.min(MANA_REGEN_MAX, Math.round((prev.manaRegen + 0.2) * 100) / 100);
            const ns = { ...prev, manaRegen: newRegen, skillPoints: prev.skillPoints - 1 };
            g.manaRegen = ns.manaRegen; g.skillPoints = ns.skillPoints; return ns;
          }
          case "4u": {
            const ab = prev.abilities.find(a => a.id === character.abilities[0]?.id);
            if (!ab || ab.level >= 5) return prev;
            const newAb = prev.abilities.map(a => a.id === ab.id ? { ...a, level: a.level + 1 } : a);
            const ns = { ...prev, abilities: newAb, skillPoints: prev.skillPoints - 1 };
            g.abilities = newAb.map(x => ({ ...x, active: g.abilities.find(y => y.id === x.id)?.active ?? false }));
            g.skillPoints = ns.skillPoints; return ns;
          }
          case "5u": {
            const ab = prev.abilities.find(a => a.id === character.abilities[1]?.id);
            if (!ab || ab.level >= 5) return prev;
            const newAb = prev.abilities.map(a => a.id === ab.id ? { ...a, level: a.level + 1 } : a);
            const ns = { ...prev, abilities: newAb, skillPoints: prev.skillPoints - 1 };
            g.abilities = newAb.map(x => ({ ...x, active: g.abilities.find(y => y.id === x.id)?.active ?? false }));
            g.skillPoints = ns.skillPoints; return ns;
          }
          default: return prev;
        }
      });
    };
  });

  // ── Multiplayer: poll room state & push position ───────────────────────────
  useEffect(() => {
    if (!roomCode || !playerId) return;

    const pushState = async () => {
      const g = st.current;
      try {
        await fetch(`${ROOMS_URL}/rooms/state`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Player-Id": playerId },
          body: JSON.stringify({ code: roomCode, px: Math.round(g.px), py: Math.round(g.py), dead: g.dead }),
        });
      } catch { /* ignore */ }
    };

    const pollState = async () => {
      try {
        const res = await fetch(`${ROOMS_URL}/rooms/${roomCode}`, {
          headers: { "X-Player-Id": playerId },
        });
        if (!res.ok) return;
        const data = await res.json();
        const others = (data.players ?? []).filter((p: RemotePlayer) => p.player_id !== playerId);
        remotePlayersRef.current = others;
        setRemotePlayers(others);
      } catch { /* ignore */ }
    };

    // Push every 100ms, poll every 200ms
    const pushInterval = setInterval(pushState, 100);
    const pollInterval = setInterval(pollState, 200);
    mpPollRef.current = pollInterval;
    pollState();

    return () => {
      clearInterval(pushInterval);
      clearInterval(pollInterval);
    };
   
  }, [roomCode, playerId]);

  useEffect(() => {
    initRoom(1);
    const g = st.current;
    g.lastManaTime = performance.now();
    g.abilityTimers = {};
    g.cooldowns = {};

    const canvas = canvasRef.current!;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      g.mouseX = e.clientX - rect.left;
      g.mouseY = e.clientY - rect.top;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      g.keys[e.code] = true;

      if (e.key === "1") upgradeRef.current("1");
      if (e.key === "2") upgradeRef.current("2");
      if (e.key === "3") upgradeRef.current("3");
      if (e.key === "4") upgradeRef.current("4u");
      if (e.key === "5") upgradeRef.current("5u");

      // Ability 1 activation (Z or J)
      if (e.code === "KeyZ" || e.code === "KeyJ") {
        const ab1id = character.abilities[0]?.id;
        if (!ab1id) return;
        const ab = g.abilities.find(a => a.id === ab1id)!;
        if (ab.level === 0) return;
        const now2 = performance.now();

        if (character.id === "red") {
          // boost: check cooldown before activating
          const cdEnd = g.cooldowns[ab1id] ?? 0;
          if (now2 < cdEnd) return; // on cooldown
          ab.active = !ab.active;
          const active = ab.active;
          if (active) g.abilityTimers[ab1id] = now2;
          setStats(prev => ({ ...prev, abilities: prev.abilities.map(a => a.id === ab1id ? { ...a, active } : a) }));
        }
        if (character.id === "red_brown") {
          const cdEnd = g.cooldowns[ab1id] ?? 0;
          if (now2 < cdEnd) return;
          ab.active = !ab.active;
          const active = ab.active;
          if (active) g.abilityTimers[ab1id] = now2;
          setStats(prev => ({ ...prev, abilities: prev.abilities.map(a => a.id === ab1id ? { ...a, active } : a) }));
        }
        if (character.id === "blue") {
          // Teleport: blocked during time freeze
          if (g.timeFrozen) return;
          // Check cooldown
          const cdEnd = g.cooldowns[ab1id] ?? 0;
          if (now2 < cdEnd) return;
          if (g.mana < 5) return;
          const camOffX = CANVAS_W / 2 - g.camX;
          const worldMouseX = g.mouseX - camOffX;
          const worldMouseY = g.mouseY - CORRIDOR_TOP;
          const dx = worldMouseX - g.px, dy = worldMouseY - g.py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const clampedDist = Math.min(dist, TELEPORT_MAX_DIST);
          const ratio = dist > 0 ? clampedDist / dist : 0;
          let newX = g.px + dx * ratio;
          let newY = g.py + dy * ratio;
          newX = Math.max(PLAYER_R, Math.min(g.room!.width - PLAYER_R, newX));
          newY = Math.max(PLAYER_R, Math.min(CORRIDOR_H - PLAYER_R, newY));
          g.px = newX; g.py = newY; g.vx = 0; g.vy = 0;
          g.mana = Math.max(0, g.mana - 5);
          // Cooldown: 5 - (level - 1) seconds, level 1->5s, 2->4s, 3->3s, 4->2s, 5->1s
          const tpCdSec = Math.max(1, 5 - (ab.level - 1));
          g.cooldowns[ab1id] = now2 + tpCdSec * 1000;
        }
      }

      // Ability 2 activation (X or K)
      if (e.code === "KeyX" || e.code === "KeyK") {
        const ab2id = character.abilities[1]?.id;
        if (!ab2id) return;
        const ab = g.abilities.find(a => a.id === ab2id)!;
        if (ab.level === 0) return;
        const now2 = performance.now();

        if (character.id === "red") {
          // brownflow: check cooldown before activating
          const cdEnd = g.cooldowns[ab2id] ?? 0;
          if (now2 < cdEnd) return;
          const wasActive = ab.active;
          ab.active = !ab.active;
          const active = ab.active;
          if (active) {
            g.abilityTimers[ab2id] = now2;
          } else if (wasActive) {
            // Apply brownflow cooldown on manual deactivation
            const brownCDs = [1250, 1000, 750, 500, 250];
            const cdMs = brownCDs[Math.max(0, ab.level - 1)] ?? 1250;
            g.cooldowns[ab2id] = now2 + cdMs;
          }
          setStats(prev => ({ ...prev, abilities: prev.abilities.map(a => a.id === ab2id ? { ...a, active } : a) }));
        }
        if (character.id === "blue") {
          if (g.mana < 30 || g.timeFrozen) return;
          g.mana = Math.max(0, g.mana - 30);
          g.timeFrozen = true;
          g.timeFreezeEnd = now2 + 5000;
          setTimeFrozen(true);
          ab.active = true;
          setStats(prev => ({ ...prev, abilities: prev.abilities.map(a => a.id === ab2id ? { ...a, active: true } : a) }));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => { g.keys[e.code] = false; };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("mousemove", handleMouseMove);

    const ctx = canvas.getContext("2d")!;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;
      const g = st.current;
      const room = g.room!;

      // Time freeze check
      if (g.timeFrozen && now >= g.timeFreezeEnd) {
        g.timeFrozen = false;
        setTimeFrozen(false);
        const ab2id = character.abilities[1]?.id;
        if (ab2id) {
          g.abilities.forEach(a => { if (a.id === ab2id) a.active = false; });
          setStats(prev => ({ ...prev, abilities: prev.abilities.map(a => a.id === ab2id ? { ...a, active: false } : a) }));
        }
      }

      // Mana regen
      const me = (now - g.lastManaTime) / 1000;
      if (me >= 0.05) { g.mana = Math.min(g.manaMax, g.mana + g.manaRegen * me); g.lastManaTime = now; }

      // Ability drains
      for (const ab of g.abilities) {
        if (!ab.active) { g.abilityTimers[ab.id] = now; continue; }
        const ae = (now - (g.abilityTimers[ab.id] ?? now)) / 1000;
        if (ae < 0.05) continue;
        let drainRate = 0;
        if (ab.id === "boost") drainRate = 2;
        if (ab.id === "brownflow") drainRate = 12;
        if (drainRate > 0) {
          g.mana = Math.max(0, g.mana - drainRate * ae);
          g.abilityTimers[ab.id] = now;
          if (g.mana <= 0) {
            ab.active = false;
            // Apply brownflow cooldown on auto-deactivation (mana runs out)
            if (ab.id === "brownflow") {
              const brownCDs = [1250, 1000, 750, 500, 250];
              const cdMs = brownCDs[Math.max(0, ab.level - 1)] ?? 1250;
              g.cooldowns[ab.id] = now + cdMs;
            }
            setStats(prev => ({ ...prev, abilities: prev.abilities.map(a => a.id === ab.id ? { ...a, active: false } : a) }));
          }
        }
      }

      // Move balls (paused during time freeze)
      if (!g.timeFrozen) {
        for (const b of g.balls) {
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
          if (b.y > CORRIDOR_H - b.r) { b.y = CORRIDOR_H - b.r; b.vy = -Math.abs(b.vy); }
          if (b.x < SAFE_ZONE + b.r) { b.x = SAFE_ZONE + b.r; b.vx = Math.abs(b.vx); }
          if (b.x > room.width - SAFE_ZONE - b.r) { b.x = room.width - SAFE_ZONE - b.r; b.vx = -Math.abs(b.vx); }
        }
      }

      if (!g.dead) {
        const boostAb = g.abilities.find(a => a.id === "boost");
        const slow = g.keys["ShiftLeft"] || g.keys["ShiftRight"] ? 1 / 3 : 1;
        const boostBonus = (boostAb?.active) ? boostSpeedBonus(boostAb.level) : 0;
        const totalSpeed = (g.speedBase + boostBonus) * SPEED_SCALE * slow;
        let dvx = 0, dvy = 0;
        if (g.keys["KeyW"]) dvy = -1;
        if (g.keys["KeyS"]) dvy = 1;
        if (g.keys["KeyA"]) dvx = -1;
        if (g.keys["KeyD"]) dvx = 1;
        if (dvx !== 0 && dvy !== 0) { dvx *= 0.707; dvy *= 0.707; }
        g.vx += (dvx * totalSpeed - g.vx) * 0.18;
        g.vy += (dvy * totalSpeed - g.vy) * 0.18;
        g.px += g.vx * dt; g.py += g.vy * dt;

        g.py = Math.max(PLAYER_R, Math.min(CORRIDOR_H - PLAYER_R, g.py));
        if (g.px < PLAYER_R) { g.px = PLAYER_R; g.vx = 0; }
        if (g.px > room.width - PLAYER_R) { g.px = room.width - PLAYER_R; g.vx = 0; }

        const minCam = CANVAS_W / 2, maxCam = room.width - CANVAS_W / 2;
        g.camX = Math.max(minCam, Math.min(maxCam > minCam ? maxCam : minCam, g.px));

        // Collision
        if (g.timeFrozen && character.id === "blue") {
          // Таймстоп: физическое столкновение без смерти — отталкиваем игрока
          for (const b of g.balls) {
            const dx = g.px - b.x, dy = g.py - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = b.r + PLAYER_R;
            if (dist < minDist && dist > 0) {
              const nx = dx / dist, ny = dy / dist;
              const overlap = minDist - dist;
              g.px += nx * overlap;
              g.py += ny * overlap;
              // Гасим скорость в направлении шара
              const dot = g.vx * nx + g.vy * ny;
              if (dot < 0) {
                g.vx -= dot * nx;
                g.vy -= dot * ny;
              }
            }
          }
          // Пережимаем в коридор после столкновений
          g.py = Math.max(PLAYER_R, Math.min(CORRIDOR_H - PLAYER_R, g.py));
          if (g.px < PLAYER_R) { g.px = PLAYER_R; g.vx = 0; }
          if (g.px > room.width - PLAYER_R) { g.px = room.width - PLAYER_R; g.vx = 0; }
        } else if (!g.timeFrozen) {
          for (const b of g.balls) {
            const dx = b.x - g.px, dy = b.y - g.py;
            if (Math.sqrt(dx * dx + dy * dy) < b.r + PLAYER_R) {
              g.dead = true;
              for (const a of g.abilities) a.active = false;
              setDead(true);
              setStats(prev => ({ ...prev, abilities: prev.abilities.map(a => ({ ...a, active: false })) }));
              break;
            }
          }
        }

        if (g.px >= room.width - PLAYER_R - 4) {
          const nl = g.level + 1; g.level = nl; g.skillPoints += 1;
          setLevel(nl); setShowLevelUp(true);
          setTimeout(() => setShowLevelUp(false), 1500);
          initRoom(nl);
          setStats(prev => ({ ...prev, skillPoints: prev.skillPoints + 1 }));
        }
      }

      // ── Render ────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#0d0d0f";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const camOffsetX = CANVAS_W / 2 - g.camX;

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,0.025)"; ctx.lineWidth = 1;
      const gs = 40;
      for (let x = ((camOffsetX % gs) + gs) % gs; x < CANVAS_W; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += gs) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
      }

      const corrTop = CORRIDOR_TOP, corrBot = CORRIDOR_TOP + CORRIDOR_H;

      // Dark outside corridor
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, CANVAS_W, corrTop);
      ctx.fillRect(0, corrBot, CANVAS_W, CANVAS_H - corrBot);

      // World left/right walls
      const wlsx = camOffsetX;
      if (wlsx > 0) { ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, corrTop, wlsx, CORRIDOR_H); }
      const wrsx = room.width + camOffsetX;
      if (wrsx < CANVAS_W) { ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(wrsx, corrTop, CANVAS_W - wrsx, CORRIDOR_H); }

      // Time freeze tint
      if (g.timeFrozen) {
        ctx.fillStyle = "rgba(100,180,255,0.08)";
        ctx.fillRect(0, corrTop, CANVAS_W, CORRIDOR_H);
      }

      // Safe zones
      const ssEX = SAFE_ZONE + camOffsetX;
      if (ssEX > 0 && camOffsetX < CANVAS_W) {
        const dx2 = Math.max(0, camOffsetX), dw = Math.min(ssEX, CANVAS_W) - dx2;
        if (dw > 0) { ctx.fillStyle = "rgba(80,120,200,0.07)"; ctx.fillRect(dx2, corrTop, dw, CORRIDOR_H); }
        if (ssEX > 0 && ssEX < CANVAS_W) {
          ctx.setLineDash([4,4]); ctx.strokeStyle = "rgba(100,150,255,0.25)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(ssEX, corrTop); ctx.lineTo(ssEX, corrBot); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      const seSX = room.width - SAFE_ZONE + camOffsetX, seEX2 = room.width + camOffsetX;
      if (seEX2 > 0 && seSX < CANVAS_W) {
        const dx2 = Math.max(0, seSX), dw = Math.min(seEX2, CANVAS_W) - dx2;
        if (dw > 0) { ctx.fillStyle = "rgba(80,120,200,0.07)"; ctx.fillRect(dx2, corrTop, dw, CORRIDOR_H); }
        if (seSX > 0 && seSX < CANVAS_W) {
          ctx.setLineDash([4,4]); ctx.strokeStyle = "rgba(100,150,255,0.25)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(seSX, corrTop); ctx.lineTo(seSX, corrBot); ctx.stroke(); ctx.setLineDash([]);
        }
      }

      // Corridor walls
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, corrTop); ctx.lineTo(CANVAS_W, corrTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, corrBot); ctx.lineTo(CANVAS_W, corrBot); ctx.stroke();

      // Exit
      const exitSX = room.width + camOffsetX;
      if (exitSX > 0 && exitSX < CANVAS_W + EXIT_W) {
        const grad = ctx.createLinearGradient(exitSX - EXIT_W, corrTop, exitSX, corrTop);
        grad.addColorStop(0, "rgba(255,220,0,0)"); grad.addColorStop(1, "rgba(255,220,0,0.4)");
        ctx.fillStyle = grad; ctx.fillRect(exitSX - EXIT_W, corrTop, EXIT_W, CORRIDOR_H);
        ctx.strokeStyle = "rgba(255,220,0,0.9)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(exitSX, corrTop); ctx.lineTo(exitSX, corrBot); ctx.stroke();
        const t2 = now / 1000;
        ctx.strokeStyle = `rgba(255,240,80,${0.3 + 0.3 * Math.sin(t2 * 3)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(exitSX - 4, corrTop); ctx.lineTo(exitSX - 4, corrBot); ctx.stroke();
      }

      // Distance to exit label
      ctx.fillStyle = "rgba(255,220,0,0.5)"; ctx.font = "11px 'Oswald', sans-serif"; ctx.textAlign = "right";
      ctx.fillText(`выход: ${Math.max(0, Math.round(room.width - g.px))}px`, CANVAS_W - 16, corrTop - 10);

      // Teleport ghost (blue char) — скрыт во время таймстопа
      if (character.id === "blue" && !g.dead && !g.timeFrozen) {
        const ab1 = g.abilities.find(a => a.id === character.abilities[0]?.id);
        if (ab1 && ab1.level > 0) {
          const camOffX2 = CANVAS_W / 2 - g.camX;
          const wmx = g.mouseX - camOffX2, wmy = g.mouseY - corrTop;
          const dx2 = wmx - g.px, dy2 = wmy - g.py;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          const clamped = Math.min(dist2, TELEPORT_MAX_DIST);
          const ratio = dist2 > 0 ? clamped / dist2 : 0;
          const tpX = g.px + dx2 * ratio;
          const tpY = Math.max(PLAYER_R, Math.min(CORRIDOR_H - PLAYER_R, g.py + dy2 * ratio));
          const tpSX = tpX + camOffX2, tpSY = tpY + corrTop;
          ctx.save();
          ctx.setLineDash([3, 5]);
          ctx.strokeStyle = "rgba(80,150,255,0.5)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(g.px + camOffX2, g.py + corrTop); ctx.lineTo(tpSX, tpSY); ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(80,150,255,0.7)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(tpSX, tpSY, PLAYER_R, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
      }

      // Balls
      for (const b of g.balls) {
        const bsx = b.x + camOffsetX, bsy = b.y + corrTop;
        if (bsx < -b.r * 2 || bsx > CANVAS_W + b.r * 2) continue;
        ctx.save();
        const ballColor0 = g.timeFrozen ? "#8ab4ff" : "#cccccc";
        const ballColor1 = g.timeFrozen ? "#3366bb" : "#555555";
        const bglow = ctx.createRadialGradient(bsx, bsy, 0, bsx, bsy, b.r * 2.5);
        bglow.addColorStop(0, g.timeFrozen ? "rgba(100,150,255,0.2)" : "rgba(160,160,160,0.15)");
        bglow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = bglow; ctx.beginPath(); ctx.arc(bsx, bsy, b.r * 2.5, 0, Math.PI * 2); ctx.fill();
        const bg2 = ctx.createRadialGradient(bsx - b.r * 0.3, bsy - b.r * 0.3, 0, bsx, bsy, b.r);
        bg2.addColorStop(0, ballColor0); bg2.addColorStop(1, ballColor1);
        ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(bsx, bsy, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Player
      const psx = g.px + camOffsetX, psy = g.py + corrTop;
      const boostAb2 = g.abilities.find(a => a.id === "boost");
      const brownAb = g.abilities.find(a => a.id === "brownflow");
      const boostActive = boostAb2?.active ?? false;
      const brownActive = brownAb?.active ?? false;
      let playerColor = character.color;
      let playerGlow = character.glow;
      if (boostActive && boostAb2) { playerColor = blendToOrange(character.color, boostAb2.level); playerGlow = "rgba(255,140,0,0.7)"; }
      if (brownActive) { playerColor = blendColor(character.color, "#7a4a1e", 0.6); playerGlow = "rgba(120,70,30,0.8)"; }

      if (!g.dead) {
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

      // Remote players (multiplayer)
      for (const rp of remotePlayersRef.current) {
        if (rp.dead) continue;
        const rpsx = rp.px + camOffsetX;
        const rpsy = rp.py + corrTop;
        if (rpsx < -PLAYER_R * 4 || rpsx > CANVAS_W + PLAYER_R * 4) continue;
        ctx.save();
        const rpGlow = ctx.createRadialGradient(rpsx, rpsy, 0, rpsx, rpsy, PLAYER_R * 2.5);
        rpGlow.addColorStop(0, `${rp.char_color}88`); rpGlow.addColorStop(1, "transparent");
        ctx.fillStyle = rpGlow; ctx.beginPath(); ctx.arc(rpsx, rpsy, PLAYER_R * 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rp.char_color;
        ctx.beginPath(); ctx.arc(rpsx, rpsy, PLAYER_R, 0, Math.PI * 2); ctx.fill();
        // Name tag
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "8px 'Oswald', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(rp.char_name, rpsx, rpsy - PLAYER_R - 4);
        ctx.restore();
      }

      // Minimap
      const mmPad = 2;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(MM_X, MM_Y, MM_W, MM_H);
      ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.strokeRect(MM_X, MM_Y, MM_W, MM_H);
      const mmInW = MM_W - mmPad * 2, mmInH = MM_H - mmPad * 2;
      const scX = mmInW / room.width, scY = mmInH / CORRIDOR_H;
      ctx.fillStyle = "rgba(80,120,200,0.15)";
      ctx.fillRect(MM_X + mmPad, MM_Y + mmPad, SAFE_ZONE * scX, mmInH);
      ctx.fillRect(MM_X + mmPad + (room.width - SAFE_ZONE) * scX, MM_Y + mmPad, SAFE_ZONE * scX, mmInH);
      for (const b of g.balls) {
        ctx.fillStyle = g.timeFrozen ? "#6699ff" : "#888";
        ctx.beginPath(); ctx.arc(MM_X + mmPad + b.x * scX, MM_Y + mmPad + b.y * scY, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "rgba(255,220,0,0.7)";
      ctx.fillRect(MM_X + mmPad + (room.width - 4) * scX, MM_Y + mmPad, 3, mmInH);
      ctx.fillStyle = character.color;
      ctx.beginPath(); ctx.arc(MM_X + mmPad + g.px * scX, MM_Y + mmPad + g.py * scY, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Sync cooldowns to UI every 6 frames
      if (g.frame % 6 === 0) {
        const cds = g.cooldowns;
        const uiCDs: Record<string, number> = {};
        for (const [id, endMs] of Object.entries(cds)) {
          const rem = Math.max(0, (endMs - now) / 1000);
          if (rem > 0) uiCDs[id] = rem;
        }
        setCooldownsUI(uiCDs);
      }

      if (g.frame % 6 === 0) {
        const lm = Math.round(g.mana * 10) / 10;
        setStats(prev => Math.abs(prev.mana - lm) < 0.01 ? prev : { ...prev, mana: lm });
      }
      g.frame++;
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const freezeTimeLeft = timeFrozen
    ? Math.max(0, Math.ceil((st.current.timeFreezeEnd - performance.now()) / 1000))
    : 0;

  // Tooltip text per ability
  const TOOLTIPS: Record<string, string> = {
    boost: "Ускорение потока\n+2/3/4/5/6 скорости\nТратит: 2 маны/с",
    brownflow: "Коричневый поток\nМощный поток силы\nТратит: 12 маны/с\nОткат после выкл: 1.25/1/0.75/0.5/0.25 с",
    teleport: "Телепорт на курсор\nМакс. 5 клеток (200px)\nСтоит: 5 маны\nПерезарядка: 5/4/3/2/1 с",
    timefreeze: "Остановка времени\n5 секунд\nСтоит: 30 маны\nОтключает телепорт",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#0d0d0f", fontFamily: "'Oswald', sans-serif" }}>
      <div className="flex items-center justify-between w-full px-6 py-3" style={{ maxWidth: CANVAS_W + 40 }}>
        <button onClick={onBack} className="text-xs tracking-widest uppercase"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >← назад</button>
        <div className="flex items-center gap-6">
          {timeFrozen && (
            <div className="text-xs tracking-widest" style={{ color: "#88ccff" }}>
              СТОП-ВРЕМЯ: <span style={{ color: "#fff" }}>{freezeTimeLeft}с</span>
            </div>
          )}
          <div className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
            УРОВЕНЬ <span style={{ color: "#fff", fontSize: 16 }}>{level}</span>
          </div>
          <div className="w-2 h-2 rounded-full" style={{ background: character.color, boxShadow: `0 0 8px ${character.glow}` }} />
          <span className="text-xs tracking-widest" style={{ color: character.color }}>{character.name}</span>
        </div>
      </div>

      <div className="relative" style={{ width: CANVAS_W, border: "1px solid rgba(255,255,255,0.07)" }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display: "block" }} />

        {dead && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "rgba(0,0,0,0.55)" }}>
            <div className="text-4xl font-black tracking-widest" style={{ color: character.color, textShadow: `0 0 30px ${character.glow}` }}>ТЫ ПОГИБ</div>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>сольный режим — конец игры</div>
            <button onClick={() => {
              setDead(false); setLevel(1); setTimeFrozen(false);
              const fresh = defaultStats(character);
              setStats(fresh);
              const g = st.current;
              Object.assign(g, { mana: fresh.mana, speedBase: fresh.speedBase, manaMax: fresh.manaMax, manaRegen: fresh.manaRegen, skillPoints: 0, timeFrozen: false });
              g.abilities = fresh.abilities.map(a => ({ ...a }));
              g.cooldowns = {};
              setCooldownsUI({});
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

      <div className="flex items-stretch gap-0 w-full"
        style={{ maxWidth: CANVAS_W, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderTop: "none" }}
      >
        <div className="flex flex-col items-center justify-center px-4 py-2" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", minWidth: 64 }}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <div className="rounded-full" style={{ width: 22, height: 22, background: stats.skillPoints > 0 ? "#ffd700" : "rgba(255,215,0,0.15)", boxShadow: stats.skillPoints > 0 ? "0 0 12px rgba(255,215,0,0.8)" : "none", transition: "all 0.3s" }} />
            {stats.skillPoints > 0 && (
              <span style={{ position: "absolute", top: -6, right: -6, background: "#ffd700", color: "#0d0d0f", borderRadius: "50%", width: 14, height: 14, fontSize: 9, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>{stats.skillPoints}</span>
            )}
          </div>
          <span style={{ color: "rgba(255,215,0,0.4)", fontSize: 8, marginTop: 3 }}>ОЧКИ</span>
        </div>

        <StatBlock label="СКОРОСТЬ" value={`${stats.speedBase.toFixed(1)}`} keyHint="1" color="#aabbff" active={stats.skillPoints > 0} />
        <StatBlock
          label="МАКС МАНА" value={`${Math.floor(stats.mana)} \\ ${stats.manaMax}`}
          keyHint="2" color="#88aaff" active={stats.skillPoints > 0}
          extra={<ManaBar current={stats.mana} max={stats.manaMax} />}
        />
        <StatBlock
          label="РЕГЕН МАНЫ" value={`${stats.manaRegen.toFixed(1)}/с`}
          keyHint="3" color="#66aaee"
          active={stats.skillPoints > 0 && stats.manaRegen < MANA_REGEN_MAX}
          extra={stats.manaRegen >= MANA_REGEN_MAX ? <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 7, marginTop: 2 }}>МАКС</div> : undefined}
        />

        <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />

        {character.abilities.map((ab, idx) => {
          const abState = stats.abilities.find(a => a.id === ab.id)!;
          const canUp = stats.skillPoints > 0 && abState.level < 5;
          const cdSec = cooldownsUI[ab.id] ?? 0;
          return (
            <AbilityBlock
              key={ab.id}
              keyUpgrade={ab.keyUpgrade}
              keyUse={ab.keyUse}
              name={ab.name}
              abilityLevel={abState.level}
              active={abState.active}
              locked={abState.level === 0}
              color={abState.active ? ab.color : `${ab.color}99`}
              activeColor={ab.color}
              canUpgrade={canUp}
              isLast={idx === character.abilities.length - 1}
              cooldownSec={cdSec}
              tooltip={TOOLTIPS[ab.id]}
            />
          );
        })}
      </div>

      <div className="mt-3 text-xs tracking-[0.25em] uppercase" style={{ color: "rgba(255,255,255,0.1)" }}>
        WASD — движение · SHIFT — медленно · 1/2/3 — стат · 4/5 — прокачка · Z/J и X/K — способности
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
        <span style={{ background: active ? "rgba(255,215,0,0.15)" : "transparent", color: active ? "#ffd700" : "rgba(255,255,255,0.15)", border: active ? "1px solid rgba(255,215,0,0.3)" : "1px solid transparent", fontSize: 9, padding: "1px 4px" }}>[{keyHint}]</span>
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

function AbilityBlock({ keyUpgrade, keyUse, name, abilityLevel, active, locked, color, activeColor, canUpgrade, isLast, cooldownSec, tooltip }: {
  keyUpgrade: string; keyUse: string; name: string; abilityLevel: number; active: boolean;
  locked: boolean; color: string; activeColor: string; canUpgrade: boolean; isLast: boolean;
  cooldownSec?: number; tooltip?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const onCooldown = (cooldownSec ?? 0) > 0;
  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-2 relative"
      style={{ minWidth: 130, borderRight: isLast ? "none" : "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip */}
      {hovered && tooltip && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(10,10,15,0.96)",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "8px 12px",
          fontSize: 10,
          color: "rgba(255,255,255,0.7)",
          whiteSpace: "pre-line",
          lineHeight: 1.6,
          pointerEvents: "none",
          zIndex: 100,
          minWidth: 180,
          fontFamily: "Golos Text, sans-serif",
          textAlign: "left",
          boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
        }}>
          {tooltip}
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ background: canUpgrade ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)", color: canUpgrade ? "#ffd700" : "rgba(255,255,255,0.2)", border: canUpgrade ? "1px solid rgba(255,215,0,0.3)" : "1px solid rgba(255,255,255,0.06)", fontSize: 9, padding: "1px 4px" }}>[{keyUpgrade}]</span>
        <span style={{ color: locked ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: "0.1em" }}>{name}</span>
        <span style={{ background: (active && !onCooldown) ? `${activeColor}22` : "rgba(255,255,255,0.05)", color: locked ? "rgba(255,255,255,0.1)" : (active && !onCooldown ? activeColor : "rgba(255,255,255,0.35)"), border: `1px solid ${locked ? "rgba(255,255,255,0.06)" : (active && !onCooldown ? activeColor : "rgba(255,255,255,0.1)")}`, fontSize: 9, padding: "1px 4px" }}>[{keyUse}]</span>
      </div>

      {/* Icon with cooldown overlay */}
      <div style={{ position: "relative", width: 20, height: 20, marginBottom: 4 }}>
        <div className="rounded-full" style={{ width: 20, height: 20, background: locked ? "rgba(255,255,255,0.05)" : (active && !onCooldown ? activeColor : color), boxShadow: (active && !onCooldown) ? `0 0 10px ${activeColor}` : "none", border: locked ? "1px solid rgba(255,255,255,0.08)" : `1px solid ${activeColor}66`, transition: "all 0.3s" }} />
        {onCooldown && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "rgba(0,0,0,0.72)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, fontWeight: "bold", color: "#fff",
          }}>
            {(cooldownSec ?? 0) < 10 ? (cooldownSec ?? 0).toFixed(1) : Math.ceil(cooldownSec ?? 0)}
          </div>
        )}
      </div>

      <div className="flex gap-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="rounded-full" style={{ width: 5, height: 5, background: i < abilityLevel ? "#ffd700" : "rgba(255,255,255,0.1)", boxShadow: i < abilityLevel ? "0 0 4px rgba(255,215,0,0.6)" : "none", transition: "all 0.3s" }} />
        ))}
      </div>
      {locked && canUpgrade && <div style={{ color: "#ffd700", fontSize: 7, marginTop: 3 }}>НАЖМИ [{keyUpgrade}]</div>}
      {locked && !canUpgrade && <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 7, marginTop: 3 }}>LOCKED</div>}
    </div>
  );
}

function lighten(hex: string, a: number): string {
  const n = parseInt(hex.replace("#",""), 16);
  return `rgb(${Math.min(255,(n>>16)+a)},${Math.min(255,((n>>8)&0xff)+a)},${Math.min(255,(n&0xff)+a)})`;
}
function blendToOrange(base: string, level: number): string {
  const t = level / 5, n = parseInt(base.replace("#",""), 16);
  return `rgb(${Math.round(((n>>16)&0xff)+(255-((n>>16)&0xff))*t)},${Math.round((((n>>8)&0xff))+(136-((n>>8)&0xff))*t)},${Math.round((n&0xff)*(1-t))})`;
}
function blendColor(base: string, target: string, t: number): string {
  const n1 = parseInt(base.replace("#",""), 16), n2 = parseInt(target.replace("#",""), 16);
  const r = Math.round(((n1>>16)&0xff)*(1-t)+((n2>>16)&0xff)*t);
  const g = Math.round((((n1>>8)&0xff))*(1-t)+(((n2>>8)&0xff))*t);
  const b = Math.round(((n1&0xff))*(1-t)+((n2&0xff))*t);
  return `rgb(${r},${g},${b})`;
}