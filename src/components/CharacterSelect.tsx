import { useState } from "react";
import Icon from "@/components/ui/icon";

const CHARACTERS = [
  {
    id: 0,
    name: "PHANTOM",
    title: "Призрак",
    color: "#00ffaa",
    desc: "Мастер скорости и уклонения. Почти неуловим в бою.",
    ability: "Рывок",
    abilityDesc: "Мгновенный телепорт на 150px вперёд. КД: 3 сек",
    abilityIcon: "Zap",
    stats: { speed: 95, health: 55, power: 60, shield: 40 },
    shape: "circle",
    unlocked: true,
  },
  {
    id: 1,
    name: "VORTEX",
    title: "Вихрь",
    color: "#aa44ff",
    desc: "Контролирует пространство. Тянет врагов в воронку.",
    ability: "Гравитация",
    abilityDesc: "Притягивает всех врагов в радиусе 200px. КД: 5 сек",
    abilityIcon: "Magnet",
    stats: { speed: 65, health: 70, power: 85, shield: 50 },
    shape: "triangle",
    unlocked: true,
  },
  {
    id: 2,
    name: "STRIKER",
    title: "Страйкер",
    color: "#ff3366",
    desc: "Агрессивный боец ближнего боя. Живёт ради атаки.",
    ability: "Берсерк",
    abilityDesc: "Урон ×2.5 на 4 секунды. КД: 8 сек",
    abilityIcon: "Flame",
    stats: { speed: 75, health: 80, power: 100, shield: 35 },
    shape: "square",
    unlocked: true,
  },
  {
    id: 3,
    name: "GHOST",
    title: "Призрак",
    color: "#33aaff",
    desc: "Невидим для врагов. Идеальный разведчик и ассасин.",
    ability: "Невидимость",
    abilityDesc: "5 секунд полной невидимости. КД: 10 сек",
    abilityIcon: "Eye",
    stats: { speed: 80, health: 50, power: 70, shield: 60 },
    shape: "diamond",
    unlocked: true,
  },
  {
    id: 4,
    name: "TITAN",
    title: "Титан",
    color: "#ff8833",
    desc: "Непробиваемая крепость. Медленный, но почти бессмертный.",
    ability: "Стена",
    abilityDesc: "Непробиваемый щит на 3 секунды. КД: 6 сек",
    abilityIcon: "Shield",
    stats: { speed: 40, health: 100, power: 75, shield: 95 },
    shape: "pentagon",
    unlocked: false,
  },
];

interface Props {
  selected: number;
  onSelect: (id: number) => void;
}

export default function CharacterSelect({ selected, onSelect }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const activeChar = CHARACTERS.find((c) => c.id === (hovered ?? selected)) || CHARACTERS[0];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-wide mb-1" style={{ fontFamily: "Oswald", color: "white" }}>
          БОЙЦЫ
        </h2>
        <p className="text-white/40 text-sm">Выберите персонажа для битвы</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Character list */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {CHARACTERS.map((char) => (
            <button
              key={char.id}
              onClick={() => char.unlocked && onSelect(char.id)}
              onMouseEnter={() => setHovered(char.id)}
              onMouseLeave={() => setHovered(null)}
              className="relative flex items-center gap-4 p-4 rounded-sm border text-left transition-all duration-200"
              style={{
                background: selected === char.id ? `${char.color}10` : "rgba(255,255,255,0.02)",
                borderColor: selected === char.id ? `${char.color}50` : "rgba(255,255,255,0.07)",
                opacity: char.unlocked ? 1 : 0.5,
                cursor: char.unlocked ? "pointer" : "not-allowed",
              }}
            >
              {/* Shape preview */}
              <CharShape color={char.color} shape={char.shape} size={44} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-base font-black tracking-wide"
                    style={{ fontFamily: "Oswald", color: selected === char.id ? char.color : "white" }}
                  >
                    {char.name}
                  </span>
                  {!char.unlocked && (
                    <Icon name="Lock" size={12} className="text-white/30" />
                  )}
                </div>
                <span className="text-xs text-white/40">{char.title}</span>
              </div>

              {selected === char.id && (
                <div
                  className="w-1.5 h-full absolute right-0 top-0 rounded-r-sm"
                  style={{ background: char.color }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Character detail */}
        <div
          className="lg:col-span-3 rounded-sm border border-white/10 p-6 relative overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          {/* BG decoration */}
          <div
            className="absolute -right-16 -top-16 opacity-5 pointer-events-none"
            style={{ animation: "spin-slow 20s linear infinite" }}
          >
            <CharShape color={activeChar.color} shape={activeChar.shape} size={220} />
          </div>

          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/30 mb-1" style={{ fontFamily: "Oswald" }}>
                  {activeChar.title}
                </div>
                <h3
                  className="text-4xl font-black tracking-wide"
                  style={{ fontFamily: "Oswald", color: activeChar.color }}
                >
                  {activeChar.name}
                </h3>
                <p className="text-white/50 text-sm mt-2 max-w-xs leading-relaxed">{activeChar.desc}</p>
              </div>
              <div className="animate-float">
                <CharShape color={activeChar.color} shape={activeChar.shape} size={80} glow />
              </div>
            </div>

            {/* Ability */}
            <div
              className="p-4 rounded-sm border mb-6"
              style={{ background: `${activeChar.color}08`, borderColor: `${activeChar.color}25` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon name={activeChar.abilityIcon} size={14} style={{ color: activeChar.color }} />
                <span
                  className="text-xs uppercase tracking-widest font-bold"
                  style={{ fontFamily: "Oswald", color: activeChar.color }}
                >
                  Способность: {activeChar.ability}
                </span>
              </div>
              <p className="text-xs text-white/50">{activeChar.abilityDesc}</p>
            </div>

            {/* Stats */}
            <div className="space-y-3">
              {[
                { key: "speed", label: "Скорость" },
                { key: "health", label: "Здоровье" },
                { key: "power", label: "Мощь" },
                { key: "shield", label: "Щит" },
              ].map(({ key, label }) => {
                const val = activeChar.stats[key as keyof typeof activeChar.stats];
                return (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-white/40">{label}</span>
                      <span className="text-xs font-bold" style={{ color: activeChar.color }}>
                        {val}
                      </span>
                    </div>
                    <div className="stat-bar">
                      <div
                        className="stat-bar-fill transition-all duration-500"
                        style={{ width: `${val}%`, background: activeChar.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Select button */}
            <button
              onClick={() => activeChar.unlocked && onSelect(activeChar.id)}
              className="mt-6 w-full py-3 text-sm font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
              style={{
                fontFamily: "Oswald",
                background: activeChar.unlocked ? activeChar.color : "rgba(255,255,255,0.05)",
                color: activeChar.unlocked ? "#0a0a0a" : "rgba(255,255,255,0.3)",
                cursor: activeChar.unlocked ? "pointer" : "not-allowed",
                boxShadow: activeChar.unlocked ? `0 0 30px ${activeChar.color}33` : "none",
              }}
            >
              {!activeChar.unlocked
                ? "🔒 Разблокировать (УР. 15)"
                : selected === activeChar.id
                ? "✓ Выбран"
                : "Выбрать бойца"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CharShape({
  color,
  shape,
  size,
  glow = false,
}: {
  color: string;
  shape: string;
  size: number;
  glow?: boolean;
}) {
  const s = size;
  const glowStyle = glow ? { filter: `drop-shadow(0 0 ${s * 0.15}px ${color}88)` } : {};

  if (shape === "circle") {
    return (
      <div
        style={{
          width: s,
          height: s,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, ${color}cc, ${color}44)`,
          border: `2px solid ${color}80`,
          flexShrink: 0,
          ...glowStyle,
        }}
      />
    );
  }
  if (shape === "triangle") {
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" style={{ flexShrink: 0, ...glowStyle }}>
        <polygon points="50,5 95,90 5,90" fill={`${color}55`} stroke={color} strokeWidth="3" />
      </svg>
    );
  }
  if (shape === "square") {
    return (
      <div
        style={{
          width: s,
          height: s,
          background: `${color}44`,
          border: `2px solid ${color}80`,
          transform: "rotate(10deg)",
          flexShrink: 0,
          ...glowStyle,
        }}
      />
    );
  }
  if (shape === "diamond") {
    return (
      <div
        style={{
          width: s * 0.8,
          height: s * 0.8,
          background: `${color}44`,
          border: `2px solid ${color}80`,
          transform: "rotate(45deg)",
          flexShrink: 0,
          ...glowStyle,
        }}
      />
    );
  }
  // pentagon
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" style={{ flexShrink: 0, ...glowStyle }}>
      <polygon points="50,5 95,35 78,90 22,90 5,35" fill={`${color}44`} stroke={color} strokeWidth="3" />
    </svg>
  );
}
