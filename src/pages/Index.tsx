import { useState } from "react";
import GameEngine from "@/components/GameEngine";

export const CHARACTERS = [
  {
    id: "red",
    name: "SCARLET",
    color: "#ff3344",
    glow: "rgba(255,51,68,0.6)",
    desc: "Базовый боец",
    ability: "Нет способностей",
    stats: { speed: 5, manaMax: 10, manaRegen: 1 },
  },
];

export default function Index() {
  const [selected, setSelected] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  if (started && selected) {
    const char = CHARACTERS.find((c) => c.id === selected)!;
    return <GameEngine character={char} onBack={() => setStarted(false)} />;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ background: "#0d0d0f", fontFamily: "'Oswald', sans-serif" }}
    >
      {/* Grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-12 px-4 w-full max-w-3xl">
        {/* Logo */}
        <div className="text-center animate-slide-up">
          <h1
            className="text-8xl font-black uppercase"
            style={{
              color: "#fff",
              letterSpacing: "0.3em",
              textShadow: "0 0 60px rgba(255,255,255,0.1)",
            }}
          >
            EVADES
          </h1>
          <p
            className="text-xs tracking-[0.5em] uppercase mt-3"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            уклоняйся · выживай · поднимайся
          </p>
        </div>

        {/* Character cards */}
        <div className="flex flex-col items-center gap-4 w-full">
          <p className="text-xs tracking-[0.4em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
            выбери персонажа
          </p>

          <div className="flex gap-5 flex-wrap justify-center">
            {CHARACTERS.map((char) => {
              const isSel = selected === char.id;
              return (
                <button
                  key={char.id}
                  onClick={() => setSelected(char.id)}
                  className="relative flex flex-col items-center gap-4 p-6 transition-all duration-300"
                  style={{
                    background: isSel
                      ? `rgba(255,255,255,0.04)`
                      : "rgba(255,255,255,0.015)",
                    border: isSel ? `1px solid ${char.color}` : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: isSel ? `0 0 40px ${char.glow.replace("0.6","0.25")}, 0 0 80px ${char.glow.replace("0.6","0.08")}` : "none",
                    minWidth: 180,
                  }}
                >
                  {/* Ball */}
                  <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
                    <div
                      className="rounded-full"
                      style={{
                        width: 64,
                        height: 64,
                        background: char.color,
                        boxShadow: isSel
                          ? `0 0 30px ${char.glow}, 0 0 60px ${char.glow.replace("0.6","0.3")}`
                          : `0 0 12px ${char.glow.replace("0.6","0.25")}`,
                        transition: "all 0.3s",
                      }}
                    />
                    {isSel && (
                      <div
                        className="absolute rounded-full"
                        style={{
                          inset: -4,
                          border: `1px solid ${char.color}`,
                          opacity: 0.4,
                          animation: "pulse-ring 2s ease-in-out infinite",
                        }}
                      />
                    )}
                  </div>

                  <div className="text-center">
                    <div
                      className="text-sm font-bold tracking-[0.2em]"
                      style={{ color: isSel ? char.color : "rgba(255,255,255,0.7)" }}
                    >
                      {char.name}
                    </div>
                    <div
                      className="text-xs mt-1"
                      style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Golos Text, sans-serif" }}
                    >
                      {char.desc}
                    </div>
                  </div>

                  {/* Stats */}
                  <div
                    className="w-full space-y-2.5 pt-3 border-t"
                    style={{ borderColor: "rgba(255,255,255,0.05)", fontFamily: "Golos Text, sans-serif" }}
                  >
                    {[
                      { label: "Скорость", val: char.stats.speed, max: 10, display: `${char.stats.speed}` },
                      { label: "Макс. мана", val: char.stats.manaMax, max: 30, display: `${char.stats.manaMax}` },
                      { label: "Реген маны", val: char.stats.manaRegen * 10, max: 1, display: `${char.stats.manaRegen}/с` },
                    ].map((s) => (
                      <div key={s.label}>
                        <div className="flex justify-between mb-1.5">
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: "0.06em" }}>{s.label}</span>
                          <span style={{ color: isSel ? char.color : "rgba(255,255,255,0.4)", fontSize: 10 }}>{s.display}</span>
                        </div>
                        <div className="stat-bar">
                          <div
                            className="stat-bar-fill"
                            style={{
                              width: `${Math.min(100, (s.val / s.max) * 100)}%`,
                              background: isSel ? char.color : "rgba(255,255,255,0.15)",
                              boxShadow: isSel ? `0 0 6px ${char.glow}` : "none",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Golos Text, sans-serif", fontSize: 10 }}
                  >
                    {char.ability}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Play */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => selected && setStarted(true)}
            disabled={!selected}
            className="relative px-20 py-4 text-sm font-bold tracking-[0.35em] uppercase transition-all duration-200"
            style={{
              background: selected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.04)",
              color: selected ? "#0d0d0f" : "rgba(255,255,255,0.15)",
              border: selected ? "none" : "1px solid rgba(255,255,255,0.08)",
              boxShadow: selected ? "0 0 50px rgba(255,255,255,0.15)" : "none",
              cursor: selected ? "pointer" : "default",
            }}
          >
            ИГРАТЬ
          </button>

          {/* Controls — only movement hint */}
          <div style={{ fontFamily: "Golos Text, sans-serif" }}>
            <div className="flex flex-col items-center gap-1">
              <span
                className="px-2 py-0.5 text-xs font-bold"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.4)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  letterSpacing: "0.06em",
                }}
              >
                WASD
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.18)", letterSpacing: "0.05em" }}>
                движение
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}