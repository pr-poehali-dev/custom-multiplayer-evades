import { useState } from "react";
import Icon from "@/components/ui/icon";

interface Player {
  rank: number;
  name: string;
  clan: string;
  level: number;
  score: number;
  wins: number;
  kills: number;
  char: string;
  color: string;
  streak: number;
  isMe?: boolean;
}

const PLAYERS: Player[] = [
  { rank: 1, name: "SHADOWBANE", clan: "VOID", level: 42, score: 128450, wins: 312, kills: 4821, char: "PHANTOM", color: "#00ffaa", streak: 8 },
  { rank: 2, name: "NEONKNIGHT", clan: "NEXUS", level: 38, score: 115200, wins: 284, kills: 4102, char: "STRIKER", color: "#ff3366", streak: 3 },
  { rank: 3, name: "VXLOID", clan: "VOID", level: 35, score: 98700, wins: 241, kills: 3890, char: "VORTEX", color: "#aa44ff", streak: 5 },
  { rank: 4, name: "GRAVEDAD", clan: "APEX", level: 33, score: 87300, wins: 208, kills: 3421, char: "GHOST", color: "#33aaff", streak: 0 },
  { rank: 5, name: "IRONFIST", clan: "APEX", level: 31, score: 76500, wins: 189, kills: 3100, char: "TITAN", color: "#ff8833", streak: 2 },
  { rank: 6, name: "CIPHERX", clan: "—", level: 28, score: 65200, wins: 165, kills: 2780, char: "PHANTOM", color: "#00ffaa", streak: 0 },
  { rank: 7, name: "BLITZ99", clan: "NEXUS", level: 26, score: 54100, wins: 142, kills: 2410, char: "STRIKER", color: "#ff3366", streak: 1 },
  { rank: 8, name: "ZEROLINE", clan: "—", level: 24, score: 44800, wins: 118, kills: 2050, char: "GHOST", color: "#33aaff", streak: 0 },
  { rank: 9, name: "PULSAR", clan: "VOID", level: 22, score: 36200, wins: 98, kills: 1780, char: "VORTEX", color: "#aa44ff", streak: 4 },
  { rank: 10, name: "Игрок", clan: "—", level: 7, score: 4820, wins: 34, kills: 218, char: "PHANTOM", color: "#00ffaa", streak: 0, isMe: true },
];

type SortKey = "score" | "wins" | "kills";

export default function RatingBoard() {
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [tab, setTab] = useState<"global" | "clan" | "weekly">("global");

  const sorted = [...PLAYERS].sort((a, b) => b[sortBy] - a[sortBy]).map((p, i) => ({ ...p, rank: i + 1 }));

  const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-black tracking-wide mb-1" style={{ fontFamily: "Oswald", color: "white" }}>
          РЕЙТИНГ
        </h2>
        <p className="text-white/40 text-sm">Лучшие бойцы вселенной VOIDRUN</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-white/5">
        {(["global", "clan", "weekly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`game-tab ${tab === t ? "active" : ""}`}
          >
            {t === "global" ? "Глобальный" : t === "clan" ? "Клановый" : "Еженедельный"}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[sorted[1], sorted[0], sorted[2]].map((p, idx) => {
          const podiumPos = [2, 1, 3][idx];
          const heights = ["h-24", "h-32", "h-20"];
          return (
            <div key={p.rank} className="flex flex-col items-center">
              <div className="text-xs text-white/40 mb-1" style={{ fontFamily: "Oswald" }}>
                {p.name}
              </div>
              <div
                className="text-2xl font-black mb-2"
                style={{ fontFamily: "Oswald", color: rankColors[podiumPos - 1] }}
              >
                #{podiumPos}
              </div>
              <div
                className={`w-full ${heights[idx]} rounded-t-sm flex items-center justify-center border-t border-x`}
                style={{
                  background: `${rankColors[podiumPos - 1]}10`,
                  borderColor: `${rankColors[podiumPos - 1]}30`,
                }}
              >
                <div>
                  <div className="text-sm font-bold text-center text-white">
                    {p.score.toLocaleString()}
                  </div>
                  <div className="text-xs text-center text-white/40">очков</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-white/30 mr-2" style={{ fontFamily: "Oswald" }}>Сортировка:</span>
        {(["score", "wins", "kills"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className="px-3 py-1 text-xs uppercase tracking-wider transition-all"
            style={{
              fontFamily: "Oswald",
              background: sortBy === key ? "rgba(0,255,170,0.15)" : "transparent",
              color: sortBy === key ? "var(--neon-green)" : "rgba(255,255,255,0.35)",
              border: sortBy === key ? "1px solid rgba(0,255,170,0.3)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {key === "score" ? "Очки" : key === "wins" ? "Победы" : "Убийства"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-sm border border-white/8 overflow-hidden">
        {/* Header */}
        <div
          className="grid text-xs uppercase tracking-wider px-4 py-2.5 text-white/30"
          style={{
            gridTemplateColumns: "2.5rem 1fr 6rem 5rem 5rem 5rem",
            fontFamily: "Oswald",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <span>#</span>
          <span>Боец</span>
          <span>Клан</span>
          <span className="text-right">Очки</span>
          <span className="text-right">Победы</span>
          <span className="text-right">Убийства</span>
        </div>

        {sorted.map((player) => (
          <div
            key={player.name}
            className="grid items-center px-4 py-3 border-t border-white/5 transition-all hover:bg-white/2"
            style={{
              gridTemplateColumns: "2.5rem 1fr 6rem 5rem 5rem 5rem",
              background: player.isMe ? "rgba(0,255,170,0.04)" : "transparent",
              borderColor: player.isMe ? "rgba(0,255,170,0.15)" : "rgba(255,255,255,0.05)",
            }}
          >
            {/* Rank */}
            <span
              className="text-sm font-bold"
              style={{
                fontFamily: "Oswald",
                color: player.rank <= 3 ? rankColors[player.rank - 1] : "rgba(255,255,255,0.3)",
              }}
            >
              {player.rank}
            </span>

            {/* Name */}
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: `${player.color}20`, color: player.color, fontFamily: "Oswald" }}
              >
                {player.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-medium"
                    style={{ color: player.isMe ? "var(--neon-green)" : "white", fontFamily: "Oswald" }}
                  >
                    {player.name}
                  </span>
                  {player.isMe && (
                    <span className="text-xs px-1.5 py-0.5" style={{ background: "rgba(0,255,170,0.15)", color: "var(--neon-green)" }}>
                      ВЫ
                    </span>
                  )}
                  {player.streak > 0 && (
                    <span className="text-xs flex items-center gap-0.5" style={{ color: "#ff8833" }}>
                      <Icon name="Flame" size={10} /> {player.streak}
                    </span>
                  )}
                </div>
                <span className="text-xs text-white/30">УР. {player.level} · {player.char}</span>
              </div>
            </div>

            {/* Clan */}
            <span className="text-xs font-medium" style={{ color: player.clan === "—" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)", fontFamily: "Oswald" }}>
              {player.clan}
            </span>

            {/* Score */}
            <span className="text-sm font-bold text-right text-white" style={{ fontFamily: "Oswald" }}>
              {player.score.toLocaleString()}
            </span>

            {/* Wins */}
            <span className="text-sm text-right text-white/60" style={{ fontFamily: "Oswald" }}>
              {player.wins}
            </span>

            {/* Kills */}
            <span className="text-sm text-right text-white/60" style={{ fontFamily: "Oswald" }}>
              {player.kills}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/20 mt-4 text-center">Рейтинг обновляется каждые 10 минут</p>
    </div>
  );
}