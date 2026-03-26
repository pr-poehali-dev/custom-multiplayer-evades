import { useState, useEffect } from "react";
import type { CharDef } from "@/pages/Index";

interface Props {
  character: CharDef;
  onBack: () => void;
  onStartSolo: () => void;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function TeamLobby({ character, onBack, onStartSolo }: Props) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [teamCode] = useState(() => generateCode());
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [copied, setCopied] = useState(false);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 600);
    return () => clearInterval(t);
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(teamCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleJoin = () => {
    const code = joinInput.trim().toUpperCase();
    if (code.length !== 6) { setJoinError("Код должен быть 6 символов"); return; }
    setJoinError("");
    // В текущей версии — пуш в solo (мультиплеер будет добавлен позже)
    onStartSolo();
  };

  const dotStr = ".".repeat(dots);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#0d0d0f", fontFamily: "'Oswald', sans-serif" }}>
      {/* Fixed grid */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`, backgroundSize: "60px 60px", zIndex: 0 }} />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-md px-4">
        {/* Back */}
        <div className="w-full">
          <button onClick={onBack} className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
          >← назад</button>
        </div>

        {/* Header */}
        <div className="text-center">
          <h2 className="text-4xl font-black tracking-[0.3em] uppercase" style={{ color: "#fff" }}>КОМАНДА</h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="rounded-full" style={{ width: 10, height: 10, background: character.color, boxShadow: `0 0 8px ${character.glow}` }} />
            <span className="text-xs tracking-widest" style={{ color: character.color }}>{character.name}</span>
          </div>
        </div>

        {mode === "choose" && (
          <div className="flex flex-col gap-4 w-full">
            <button
              onClick={() => setMode("create")}
              className="w-full py-5 text-sm font-bold tracking-[0.3em] uppercase transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            >
              СОЗДАТЬ КОМАНДУ
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full py-5 text-sm font-bold tracking-[0.3em] uppercase transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            >
              ВОЙТИ В КОМАНДУ
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="text-center">
              <div className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>код команды</div>
              {/* Code display */}
              <div className="flex gap-2 justify-center mb-3">
                {teamCode.split("").map((ch, i) => (
                  <div key={i} className="flex items-center justify-center" style={{ width: 44, height: 52, background: "rgba(255,255,255,0.05)", border: `1px solid ${character.color}44`, fontSize: 22, fontWeight: "bold", color: character.color, letterSpacing: 0 }}>
                    {ch}
                  </div>
                ))}
              </div>
              <button
                onClick={copyCode}
                className="px-6 py-2 text-xs font-bold tracking-[0.2em] uppercase transition-all"
                style={{ background: copied ? character.color : "rgba(255,255,255,0.05)", color: copied ? "#0d0d0f" : "rgba(255,255,255,0.5)", border: `1px solid ${copied ? character.color : "rgba(255,255,255,0.1)"}` }}
              >
                {copied ? "СКОПИРОВАНО!" : "СКОПИРОВАТЬ КОД"}
              </button>
            </div>

            {/* Waiting */}
            <div className="w-full p-5 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-xs tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>ожидание игроков</div>
              <div className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.15)", letterSpacing: "0.3em" }}>{dotStr || "."}</div>
              <div className="mt-3 text-xs" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "Golos Text, sans-serif" }}>
                Поделись кодом с другом · Мультиплеер скоро
              </div>
            </div>

            {/* Slots */}
            <div className="w-full space-y-2">
              <div className="flex items-center gap-3 p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="rounded-full" style={{ width: 12, height: 12, background: character.color, boxShadow: `0 0 6px ${character.glow}`, flexShrink: 0 }} />
                <span className="text-xs tracking-widest" style={{ color: character.color }}>{character.name}</span>
                <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Golos Text, sans-serif" }}>ВЫ</span>
              </div>
              {[2, 3, 4].map(n => (
                <div key={n} className="flex items-center gap-3 p-3" style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(255,255,255,0.04)" }}>
                  <div className="rounded-full" style={{ width: 12, height: 12, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                  <span className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.15)" }}>СЛОТ {n}</span>
                </div>
              ))}
            </div>

            <button onClick={onStartSolo} className="w-full py-4 text-sm font-bold tracking-[0.3em] uppercase"
              style={{ background: "rgba(255,255,255,0.9)", color: "#0d0d0f", cursor: "pointer" }}
            >
              НАЧАТЬ ИГРУ
            </button>

            <button onClick={() => setMode("choose")} className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>← назад</button>
          </div>
        )}

        {mode === "join" && (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="text-xs tracking-[0.3em] uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>введи код команды</div>

            {/* Code input cells */}
            <div className="flex gap-2 justify-center">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center justify-center" style={{ width: 44, height: 52, background: "rgba(255,255,255,0.05)", border: `1px solid ${joinInput.length > i ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`, fontSize: 22, fontWeight: "bold", color: "#fff" }}>
                  {joinInput[i] || ""}
                </div>
              ))}
            </div>

            <input
              autoFocus
              value={joinInput}
              onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); setJoinInput(v); setJoinError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleJoin(); }}
              placeholder="XXXXXX"
              className="text-center text-xl font-bold tracking-[0.5em] uppercase w-full"
              style={{ background: "transparent", border: "none", outline: "none", color: "transparent", caretColor: "transparent", position: "absolute", opacity: 0, pointerEvents: "auto" }}
            />

            {/* Invisible real input overlay trick — use visible input instead */}
            <input
              autoFocus
              value={joinInput}
              onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); setJoinInput(v); setJoinError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleJoin(); }}
              maxLength={6}
              className="w-full text-center text-2xl font-bold tracking-[0.5em] uppercase py-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", outline: "none", color: "#fff", letterSpacing: "0.4em", fontFamily: "'Oswald', sans-serif" }}
            />

            {joinError && <div className="text-xs" style={{ color: "#ff6666", fontFamily: "Golos Text, sans-serif" }}>{joinError}</div>}

            <button
              onClick={handleJoin}
              disabled={joinInput.length !== 6}
              className="w-full py-4 text-sm font-bold tracking-[0.3em] uppercase transition-all"
              style={{ background: joinInput.length === 6 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.04)", color: joinInput.length === 6 ? "#0d0d0f" : "rgba(255,255,255,0.15)", cursor: joinInput.length === 6 ? "pointer" : "default" }}
            >
              ПРИСОЕДИНИТЬСЯ
            </button>

            <button onClick={() => setMode("choose")} className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>← назад</button>
          </div>
        )}
      </div>
    </div>
  );
}
