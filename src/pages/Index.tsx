import { useState, useEffect, useRef, useCallback } from "react";
import GameArena from "@/components/GameArena";
import CharacterSelect from "@/components/CharacterSelect";
import RatingBoard from "@/components/RatingBoard";
import ClanSystem from "@/components/ClanSystem";
import Icon from "@/components/ui/icon";

type Screen = "menu" | "characters" | "arenas" | "rating" | "clans" | "game";

const NAV_TABS = [
  { id: "menu", label: "Главная", icon: "Hexagon" },
  { id: "characters", label: "Бойцы", icon: "Sword" },
  { id: "arenas", label: "Арены", icon: "Map" },
  { id: "rating", label: "Рейтинг", icon: "Trophy" },
  { id: "clans", label: "Кланы", icon: "Shield" },
] as const;

export default function Index() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [selectedChar, setSelectedChar] = useState(0);
  const [selectedArena, setSelectedArena] = useState(0);
  const [playerName, setPlayerName] = useState("Игрок");
  const [editingName, setEditingName] = useState(false);
  const [level] = useState(7);
  const [xp] = useState(340);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameRef.current) nameRef.current.focus();
  }, [editingName]);

  if (screen === "game") {
    return (
      <GameArena
        characterId={selectedChar}
        arenaId={selectedArena}
        playerName={playerName}
        onExit={() => setScreen("menu")}
      />
    );
  }

  return (
    <div className="min-h-screen void-grid flex flex-col" style={{ background: "var(--void-bg)" }}>
      {/* Scan line effect */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <div
          className="absolute w-full h-[2px] opacity-[0.03]"
          style={{
            background: "linear-gradient(transparent, rgba(0,255,170,0.5), transparent)",
            animation: "scan-line 8s linear infinite",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rotate-45 glow-green" style={{ background: "var(--neon-green)" }} />
          <span
            className="text-2xl font-black tracking-widest text-glow-green"
            style={{ fontFamily: "Oswald", color: "var(--neon-green)" }}
          >
            VOIDRUN
          </span>
        </div>

        {/* Player info */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              {editingName ? (
                <input
                  ref={nameRef}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                  className="bg-transparent border-b border-white/30 text-white text-sm outline-none w-24 text-right"
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-white text-sm font-medium hover:text-green-400 transition-colors"
                >
                  {playerName}
                </button>
              )}
              <Icon name="Pencil" size={10} className="text-white/30" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-white/40">УР. {level}</span>
              <div className="w-20 h-1 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(xp / 500) * 100}%`, background: "var(--neon-green)" }}
                />
              </div>
              <span className="text-xs text-white/30">{xp}/500</span>
            </div>
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10"
            style={{ background: "rgba(0,255,170,0.1)" }}
          >
            <span className="text-sm font-bold" style={{ color: "var(--neon-green)" }}>
              {playerName[0]?.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="relative z-10 flex items-center gap-0 px-6 border-b border-white/5">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setScreen(tab.id as Screen)}
            className={`game-tab ${screen === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        {screen === "menu" && (
          <MenuScreen
            selectedChar={selectedChar}
            selectedArena={selectedArena}
            onPlay={() => setScreen("game")}
            onCharacters={() => setScreen("characters")}
            onArenas={() => setScreen("arenas")}
            level={level}
          />
        )}
        {screen === "characters" && (
          <CharacterSelect selected={selectedChar} onSelect={setSelectedChar} />
        )}
        {screen === "arenas" && (
          <ArenasScreen selected={selectedArena} onSelect={setSelectedArena} />
        )}
        {screen === "rating" && <RatingBoard />}
        {screen === "clans" && <ClanSystem playerName={playerName} level={level} />}
      </main>
    </div>
  );
}

/* ===== MENU SCREEN ===== */
const CHARACTERS = [
  { id: 0, name: "PHANTOM", color: "#00ffaa" },
  { id: 1, name: "VORTEX", color: "#aa44ff" },
  { id: 2, name: "STRIKER", color: "#ff3366" },
  { id: 3, name: "GHOST", color: "#33aaff" },
  { id: 4, name: "TITAN", color: "#ff8833" },
];

const ARENAS = [
  { id: 0, name: "ПУСТОТА", color: "#00ffaa" },
  { id: 1, name: "НЕКСУС", color: "#aa44ff" },
  { id: 2, name: "КРАТЕР", color: "#ff3366" },
];

function MenuScreen({
  selectedChar,
  selectedArena,
  onPlay,
  onCharacters,
  onArenas,
  level,
}: {
  selectedChar: number;
  selectedArena: number;
  onPlay: () => void;
  onCharacters: () => void;
  onArenas: () => void;
  level: number;
}) {
  const char = CHARACTERS[selectedChar];
  const arena = ARENAS[selectedArena];

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {/* Hero play card */}
      <div
        className="lg:col-span-2 relative overflow-hidden rounded-sm border border-white/10 p-8 flex flex-col justify-between"
        style={{ minHeight: 340, background: "rgba(255,255,255,0.02)" }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute opacity-5"
              style={{
                width: 40 + i * 20,
                height: 40 + i * 20,
                border: `1px solid ${char.color}`,
                borderRadius: i % 2 === 0 ? "50%" : 0,
                transform: `rotate(${i * 15}deg)`,
                top: `${10 + i * 8}%`,
                right: `${5 + i * 4}%`,
              }}
            />
          ))}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full animate-blink" style={{ background: "#00ff88" }} />
            <span className="text-xs uppercase tracking-widest text-white/40" style={{ fontFamily: "Oswald" }}>
              Онлайн: 1,247 бойцов
            </span>
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-2" style={{ fontFamily: "Oswald", color: "white" }}>
            ГОТОВ К
            <br />
            <span style={{ color: char.color }}>{arena.name}?</span>
          </h1>
          <p className="text-white/40 text-sm">
            Выбран: <span className="text-white/70">{char.name}</span> · Арена:{" "}
            <span className="text-white/70">{arena.name}</span>
          </p>
        </div>

        <div className="flex items-end justify-between mt-8">
          <div className="flex gap-3">
            <button
              onClick={onCharacters}
              className="px-4 py-2 text-xs uppercase tracking-widest border border-white/15 text-white/60 hover:border-white/30 hover:text-white/90 transition-all"
              style={{ fontFamily: "Oswald" }}
            >
              Сменить бойца
            </button>
            <button
              onClick={onArenas}
              className="px-4 py-2 text-xs uppercase tracking-widest border border-white/15 text-white/60 hover:border-white/30 hover:text-white/90 transition-all"
              style={{ fontFamily: "Oswald" }}
            >
              Сменить арену
            </button>
          </div>
          <button
            onClick={onPlay}
            className="px-8 py-3 text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
            style={{
              fontFamily: "Oswald",
              background: char.color,
              color: "#0a0a0a",
              boxShadow: `0 0 30px ${char.color}44, 0 0 60px ${char.color}22`,
            }}
          >
            ▶ В БОЙ
          </button>
        </div>
      </div>

      {/* Stats sidebar */}
      <div className="flex flex-col gap-4">
        <div className="rounded-sm border border-white/10 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
          <h3 className="text-xs uppercase tracking-widest text-white/40 mb-4" style={{ fontFamily: "Oswald" }}>
            Мой прогресс
          </h3>
          {[
            { label: "Победы", value: "34", icon: "Trophy" },
            { label: "Убийств", value: "218", icon: "Zap" },
            { label: "Лучший счёт", value: "4,820", icon: "Star" },
            { label: "Матчей", value: "89", icon: "Activity" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name={stat.icon} size={13} className="text-white/30" />
                <span className="text-xs text-white/50">{stat.label}</span>
              </div>
              <span className="text-sm font-semibold text-white">{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="rounded-sm border border-white/10 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
          <h3 className="text-xs uppercase tracking-widest text-white/40 mb-4" style={{ fontFamily: "Oswald" }}>
            Задания
          </h3>
          {[
            { label: "Выжить 5 мин", progress: 60, color: "#00ffaa" },
            { label: "Убить 10 врагов", progress: 30, color: "#aa44ff" },
            { label: "Победить в матче", progress: 0, color: "#ff3366" },
          ].map((mission) => (
            <div key={mission.label} className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-white/50">{mission.label}</span>
                <span className="text-xs" style={{ color: mission.color }}>{mission.progress}%</span>
              </div>
              <div className="stat-bar">
                <div className="stat-bar-fill" style={{ width: `${mission.progress}%`, background: mission.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-sm border border-white/10 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
          <h3 className="text-xs uppercase tracking-widest text-white/40 mb-4" style={{ fontFamily: "Oswald" }}>
            Режим игры
          </h3>
          {[
            { label: "Одиночный", desc: "1 vs все", active: true, icon: "User" },
            { label: "Кооператив", desc: "2-4 игрока", active: false, icon: "Users" },
            { label: "Клановый", desc: "5 vs 5", active: false, icon: "Shield" },
          ].map((mode) => (
            <button
              key={mode.label}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-sm mb-1.5 text-left transition-all"
              style={{
                background: mode.active ? "rgba(0,255,170,0.08)" : "transparent",
                border: mode.active ? "1px solid rgba(0,255,170,0.2)" : "1px solid transparent",
              }}
            >
              <Icon
                name={mode.icon}
                size={14}
                style={{ color: mode.active ? "var(--neon-green)" : "rgba(255,255,255,0.3)" }}
              />
              <div>
                <div
                  className="text-xs font-medium"
                  style={{ color: mode.active ? "var(--neon-green)" : "rgba(255,255,255,0.6)", fontFamily: "Oswald" }}
                >
                  {mode.label}
                </div>
                <div className="text-xs text-white/25">{mode.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== ARENAS SCREEN ===== */
const ARENA_DATA = [
  {
    id: 0,
    name: "ПУСТОТА",
    desc: "Бесконечное чёрное поле. Нет стен — нет пощады.",
    color: "#00ffaa",
    features: ["Нет границ", "Туман войны", "Дрейфующие зоны"],
    difficulty: "Начало",
    players: "2–8",
  },
  {
    id: 1,
    name: "НЕКСУС",
    desc: "Нейронная сеть из коридоров и узлов. Бой в лабиринте.",
    color: "#aa44ff",
    features: ["Узкие коридоры", "Телепорт-узлы", "Энерго-щиты"],
    difficulty: "Средний",
    players: "4–12",
  },
  {
    id: 2,
    name: "КРАТЕР",
    desc: "Вулканическое поле с опасными зонами и лавой.",
    color: "#ff3366",
    features: ["Лавовые потоки", "Взрывы", "Платформы"],
    difficulty: "Эксперт",
    players: "2–6",
  },
];

function ArenasScreen({ selected, onSelect }: { selected: number; onSelect: (id: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-wide mb-1" style={{ fontFamily: "Oswald", color: "white" }}>
          АРЕНЫ
        </h2>
        <p className="text-white/40 text-sm">Выберите поле битвы</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ARENA_DATA.map((arena) => (
          <button
            key={arena.id}
            onClick={() => onSelect(arena.id)}
            onMouseEnter={() => setHovered(arena.id)}
            onMouseLeave={() => setHovered(null)}
            className="relative text-left rounded-sm border transition-all duration-300 p-6 overflow-hidden"
            style={{
              background:
                selected === arena.id
                  ? `${arena.color}08`
                  : hovered === arena.id
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(255,255,255,0.02)",
              borderColor:
                selected === arena.id
                  ? `${arena.color}40`
                  : hovered === arena.id
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(255,255,255,0.07)",
            }}
          >
            {selected === arena.id && (
              <div
                className="absolute top-3 right-3 text-xs px-2 py-0.5 font-bold"
                style={{ fontFamily: "Oswald", background: arena.color, color: "#0a0a0a" }}
              >
                ВЫБРАНО
              </div>
            )}

            <div className="relative w-full h-28 mb-5 overflow-hidden rounded-sm" style={{ background: "#0d0d0d" }}>
              <ArenaPreview arenaId={arena.id} color={arena.color} />
            </div>

            <h3
              className="text-xl font-black tracking-wider mb-2"
              style={{ fontFamily: "Oswald", color: arena.color }}
            >
              {arena.name}
            </h3>
            <p className="text-xs text-white/40 mb-4 leading-relaxed">{arena.desc}</p>

            <div className="flex gap-3 mb-4 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <Icon name="Users" size={11} /> {arena.players}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="Zap" size={11} /> {arena.difficulty}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {arena.features.map((f) => (
                <span
                  key={f}
                  className="text-xs px-2 py-0.5 rounded-sm"
                  style={{ background: `${arena.color}15`, color: arena.color }}
                >
                  {f}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ArenaPreview({ arenaId, color }: { arenaId: number; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth || 300;
    canvas.height = canvas.offsetHeight || 112;
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (arenaId === 0) {
      ctx.strokeStyle = color + "20";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 20 + i * 22, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(
          20 + Math.random() * (canvas.width - 40),
          10 + Math.random() * (canvas.height - 20),
          2 + Math.random() * 3,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = color + "60";
        ctx.fill();
      }
    } else if (arenaId === 1) {
      ctx.strokeStyle = color + "20";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 18) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 18) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(20 + Math.random() * (canvas.width - 40), 10 + Math.random() * (canvas.height - 20), 5, 0, Math.PI * 2);
        ctx.fillStyle = color + "90";
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.arc(
          20 + Math.random() * (canvas.width - 40),
          10 + Math.random() * (canvas.height - 20),
          8 + Math.random() * 16,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = color + "18";
        ctx.fill();
        ctx.strokeStyle = color + "40";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }, [arenaId, color]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}