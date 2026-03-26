import { useState } from "react";
import GameEngine from "@/components/GameEngine";
import TeamLobby from "@/components/TeamLobby";

interface CharAbilityDef {
  id: string; name: string; keyUpgrade: string; keyUse: string;
  desc: string; color: string;
}

export interface CharDef {
  id: string; name: string; color: string; glow: string;
  desc: string; stats: { speed: number; manaMax: number; manaRegen: number };
  abilities: CharAbilityDef[];
}

export const CHARACTERS: CharDef[] = [
  {
    id: "red",
    name: "VERMILLON",
    color: "#ff3344",
    glow: "rgba(255,51,68,0.6)",
    desc: "Мастер потока",
    stats: { speed: 5, manaMax: 30, manaRegen: 1 },
    abilities: [
      { id: "boost", name: "УСКОРЕНИЕ", keyUpgrade: "4", keyUse: "Z/J", desc: "+2-6 скорость, -2 маны/с", color: "#ff8800" },
      { id: "brownflow", name: "КОРИЧН.ПОТОК", keyUpgrade: "5", keyUse: "X/K", desc: "Поток силы, -12 маны/с", color: "#8B4513" },
    ],
  },
  {
    id: "blue",
    name: "AZURE",
    color: "#3399ff",
    glow: "rgba(51,153,255,0.6)",
    desc: "Повелитель пространства",
    stats: { speed: 5, manaMax: 30, manaRegen: 1 },
    abilities: [
      { id: "teleport", name: "ТЕЛЕПОРТ", keyUpgrade: "4", keyUse: "Z/J", desc: "На курсор (≤5 клеток), -5 маны", color: "#44aaff" },
      { id: "timefreeze", name: "СТОП-ВРЕМЯ", keyUpgrade: "5", keyUse: "X/K", desc: "5 сек остановки, -30 маны", color: "#88ddff" },
    ],
  },
];

type Screen = "menu" | "team" | "game";

export default function Index() {
  const [selected, setSelected] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");

  if (screen === "game" && selected) {
    const char = CHARACTERS.find((c) => c.id === selected)!;
    return <GameEngine character={char} onBack={() => setScreen("menu")} />;
  }

  if (screen === "team" && selected) {
    const char = CHARACTERS.find((c) => c.id === selected)!;
    return <TeamLobby character={char} onBack={() => setScreen("menu")} />;
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

      <div className="relative z-10 flex flex-col items-center gap-10 px-4 w-full max-w-4xl">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-8xl font-black uppercase" style={{ color: "#fff", letterSpacing: "0.3em", textShadow: "0 0 60px rgba(255,255,255,0.1)" }}>
            EVADES
          </h1>
          <p className="text-xs tracking-[0.5em] uppercase mt-3" style={{ color: "rgba(255,255,255,0.2)" }}>
            уклоняйся · выживай · поднимайся
          </p>
        </div>

        {/* Character cards */}
        <div className="flex flex-col items-center gap-4 w-full">
          <p className="text-xs tracking-[0.4em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>выбери персонажа</p>
          <div className="flex gap-5 flex-wrap justify-center">
            {CHARACTERS.map((char) => {
              const isSel = selected === char.id;
              return (
                <button
                  key={char.id}
                  onClick={() => setSelected(char.id)}
                  className="relative flex flex-col items-center gap-3 p-6 transition-all duration-300"
                  style={{
                    background: isSel ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
                    border: isSel ? `1px solid ${char.color}` : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: isSel ? `0 0 40px ${char.glow.replace("0.6","0.25")}, 0 0 80px ${char.glow.replace("0.6","0.08")}` : "none",
                    minWidth: 200,
                  }}
                >
                  {/* Ball */}
                  <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
                    <div className="rounded-full" style={{ width: 64, height: 64, background: char.color, boxShadow: isSel ? `0 0 30px ${char.glow}, 0 0 60px ${char.glow.replace("0.6","0.3")}` : `0 0 12px ${char.glow.replace("0.6","0.25")}`, transition: "all 0.3s" }} />
                    {isSel && <div className="absolute rounded-full" style={{ inset: -4, border: `1px solid ${char.color}`, opacity: 0.4, animation: "pulse-ring 2s ease-in-out infinite" }} />}
                  </div>

                  <div className="text-center">
                    <div className="text-sm font-bold tracking-[0.2em]" style={{ color: isSel ? char.color : "rgba(255,255,255,0.7)" }}>{char.name}</div>
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Golos Text, sans-serif" }}>{char.desc}</div>
                  </div>

                  {/* Stats */}
                  <div className="w-full space-y-2 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)", fontFamily: "Golos Text, sans-serif" }}>
                    {[
                      { label: "Скорость", val: char.stats.speed / 10, display: `${char.stats.speed}` },
                      { label: "Макс. мана", val: char.stats.manaMax / 30, display: `${char.stats.manaMax}` },
                      { label: "Реген маны", val: 1 / 7, display: `1/с` },
                    ].map((s) => (
                      <div key={s.label}>
                        <div className="flex justify-between mb-1">
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{s.label}</span>
                          <span style={{ color: isSel ? char.color : "rgba(255,255,255,0.4)", fontSize: 10 }}>{s.display}</span>
                        </div>
                        <div className="stat-bar">
                          <div className="stat-bar-fill" style={{ width: `${Math.min(100, s.val * 100)}%`, background: isSel ? char.color : "rgba(255,255,255,0.15)", boxShadow: isSel ? `0 0 6px ${char.glow}` : "none" }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Abilities */}
                  <div className="w-full space-y-1 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.05)", fontFamily: "Golos Text, sans-serif" }}>
                    {char.abilities.map(ab => (
                      <div key={ab.id} className="flex items-center gap-2">
                        <span style={{ color: isSel ? ab.color : "rgba(255,255,255,0.2)", fontSize: 8, border: `1px solid ${isSel ? ab.color : "rgba(255,255,255,0.08)"}`, padding: "1px 4px", letterSpacing: "0.05em" }}>[{ab.keyUse}]</span>
                        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>{ab.name}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-4">
            <button
              onClick={() => selected && setScreen("game")}
              disabled={!selected}
              className="px-16 py-4 text-sm font-bold tracking-[0.35em] uppercase transition-all duration-200"
              style={{
                background: selected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.04)",
                color: selected ? "#0d0d0f" : "rgba(255,255,255,0.15)",
                border: selected ? "none" : "1px solid rgba(255,255,255,0.08)",
                boxShadow: selected ? "0 0 50px rgba(255,255,255,0.15)" : "none",
                cursor: selected ? "pointer" : "default",
              }}
            >
              ИГРАТЬ СОЛО
            </button>
            <button
              onClick={() => selected && setScreen("team")}
              disabled={!selected}
              className="px-10 py-4 text-sm font-bold tracking-[0.25em] uppercase transition-all duration-200"
              style={{
                background: "transparent",
                color: selected ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)",
                border: selected ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
                cursor: selected ? "pointer" : "default",
              }}
            >
              КОМАНДА
            </button>
          </div>

          <div style={{ fontFamily: "Golos Text, sans-serif" }}>
            <div className="flex flex-col items-center gap-1">
              <span className="px-2 py-0.5 text-xs font-bold" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>WASD</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>движение</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}