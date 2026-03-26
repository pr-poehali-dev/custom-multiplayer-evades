import { useState, useEffect, useRef, useCallback } from "react";
import type { CharDef } from "@/pages/Index";
import GameEngine from "@/components/GameEngine";

const ROOMS_URL = "https://functions.poehali.dev/2defc3c7-a0de-4530-b005-9363bbfb56f3";

// Генерируем стабильный ID игрока в localStorage
function getPlayerId(): string {
  let id = localStorage.getItem("evades_player_id");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("evades_player_id", id);
  }
  return id;
}

interface TeamPlayer {
  player_id: string;
  char_name: string;
  char_color: string;
  px: number;
  py: number;
  dead: boolean;
}

interface Props {
  character: CharDef;
  onBack: () => void;
  onStartSolo: () => void;
}

function generateLocalCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function TeamLobby({ character, onBack }: Props) {
  const [mode, setMode] = useState<"choose" | "create" | "join" | "lobby" | "game">("choose");
  const [roomCode, setRoomCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [copied, setCopied] = useState(false);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerId = useRef(getPlayerId());

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const pollRoom = useCallback(async (code: string) => {
    try {
      const res = await fetch(`${ROOMS_URL}/rooms/${code}`, {
        headers: { "X-Player-Id": playerId.current },
      });
      if (!res.ok) return;
      const data = await res.json();
      setPlayers(data.players ?? []);
    } catch { /* ignore */ }
  }, []);

  const startPolling = useCallback((code: string) => {
    stopPoll();
    pollRoom(code);
    pollRef.current = setInterval(() => pollRoom(code), 2000);
  }, [pollRoom, stopPoll]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const createRoom = async () => {
    setLoading(true); setError("");
    try {
      const code = generateLocalCode();
      const res = await fetch(`${ROOMS_URL}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Player-Id": playerId.current },
        body: JSON.stringify({ character: { id: character.id, name: character.name, color: character.color }, code }),
      });
      if (!res.ok) { setError("Ошибка создания комнаты"); setLoading(false); return; }
      const data = await res.json();
      const serverCode = data.code ?? code;
      setRoomCode(serverCode);
      setMode("lobby");
      startPolling(serverCode);
    } catch {
      setError("Нет соединения с сервером");
    }
    setLoading(false);
  };

  const joinRoom = async () => {
    const code = joinInput.trim().toUpperCase();
    if (code.length !== 6) { setJoinError("Код должен быть 6 символов"); return; }
    setLoading(true); setJoinError(""); setError("");
    try {
      const res = await fetch(`${ROOMS_URL}/rooms/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Player-Id": playerId.current },
        body: JSON.stringify({ code, character: { id: character.id, name: character.name, color: character.color } }),
      });
      if (res.status === 404) { setJoinError("Комната не найдена"); setLoading(false); return; }
      if (!res.ok) { setJoinError("Ошибка входа"); setLoading(false); return; }
      setRoomCode(code);
      setMode("lobby");
      startPolling(code);
    } catch {
      setJoinError("Нет соединения с сервером");
    }
    setLoading(false);
  };

  const startGame = () => {
    stopPoll();
    setMode("game");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Render: game mode ───────────────────────────────────────────────────
  if (mode === "game") {
    return (
      <GameEngine
        character={character}
        onBack={() => { setMode("lobby"); startPolling(roomCode); }}
        roomCode={roomCode}
        playerId={playerId.current}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#0d0d0f", fontFamily: "'Oswald', sans-serif" }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`, backgroundSize: "60px 60px", zIndex: 0 }} />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-md px-4">
        <div className="w-full">
          <button onClick={mode === "lobby" ? () => { stopPoll(); setMode("choose"); } : onBack}
            className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
          >← назад</button>
        </div>

        <div className="text-center">
          <h2 className="text-4xl font-black tracking-[0.3em] uppercase" style={{ color: "#fff" }}>КОМАНДА</h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="rounded-full" style={{ width: 10, height: 10, background: character.color, boxShadow: `0 0 8px ${character.glow}` }} />
            <span className="text-xs tracking-widest" style={{ color: character.color }}>{character.name}</span>
          </div>
        </div>

        {error && <div className="w-full text-center text-xs py-2 px-4" style={{ background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.2)", color: "#ff6666", fontFamily: "Golos Text, sans-serif" }}>{error}</div>}

        {/* ── CHOOSE ── */}
        {mode === "choose" && (
          <div className="flex flex-col gap-4 w-full">
            <button onClick={createRoom} disabled={loading}
              className="w-full py-5 text-sm font-bold tracking-[0.3em] uppercase transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: loading ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", cursor: loading ? "default" : "pointer" }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            >
              {loading ? "СОЗДАНИЕ..." : "СОЗДАТЬ КОМАНДУ"}
            </button>
            <button onClick={() => setMode("join")} disabled={loading}
              className="w-full py-5 text-sm font-bold tracking-[0.3em] uppercase transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            >
              ВОЙТИ В КОМАНДУ
            </button>
          </div>
        )}

        {/* ── JOIN ── */}
        {mode === "join" && (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="text-xs tracking-[0.3em] uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>введи код команды</div>
            <div className="flex gap-2 justify-center">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center justify-center"
                  style={{ width: 44, height: 52, background: "rgba(255,255,255,0.05)", border: `1px solid ${joinInput.length > i ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`, fontSize: 22, fontWeight: "bold", color: "#fff" }}>
                  {joinInput[i] || ""}
                </div>
              ))}
            </div>
            <input autoFocus value={joinInput} maxLength={6}
              onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); setJoinInput(v); setJoinError(""); }}
              onKeyDown={e => { if (e.key === "Enter") joinRoom(); }}
              className="w-full text-center text-2xl font-bold tracking-[0.5em] uppercase py-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", outline: "none", color: "#fff", fontFamily: "'Oswald', sans-serif" }}
            />
            {joinError && <div className="text-xs" style={{ color: "#ff6666", fontFamily: "Golos Text, sans-serif" }}>{joinError}</div>}
            <button onClick={joinRoom} disabled={joinInput.length !== 6 || loading}
              className="w-full py-4 text-sm font-bold tracking-[0.3em] uppercase"
              style={{ background: joinInput.length === 6 && !loading ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.04)", color: joinInput.length === 6 && !loading ? "#0d0d0f" : "rgba(255,255,255,0.15)", cursor: joinInput.length === 6 && !loading ? "pointer" : "default" }}
            >
              {loading ? "ПОДКЛЮЧЕНИЕ..." : "ПРИСОЕДИНИТЬСЯ"}
            </button>
            <button onClick={() => setMode("choose")} className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>← назад</button>
          </div>
        )}

        {/* ── LOBBY ── */}
        {mode === "lobby" && (
          <div className="flex flex-col items-center gap-6 w-full">
            {/* Code display */}
            <div className="text-center">
              <div className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>код команды</div>
              <div className="flex gap-2 justify-center mb-3">
                {roomCode.split("").map((ch, i) => (
                  <div key={i} className="flex items-center justify-center"
                    style={{ width: 44, height: 52, background: "rgba(255,255,255,0.05)", border: `1px solid ${character.color}44`, fontSize: 22, fontWeight: "bold", color: character.color }}>
                    {ch}
                  </div>
                ))}
              </div>
              <button onClick={copyCode} className="px-6 py-2 text-xs font-bold tracking-[0.2em] uppercase"
                style={{ background: copied ? character.color : "rgba(255,255,255,0.05)", color: copied ? "#0d0d0f" : "rgba(255,255,255,0.5)", border: `1px solid ${copied ? character.color : "rgba(255,255,255,0.1)"}` }}
              >
                {copied ? "СКОПИРОВАНО!" : "СКОПИРОВАТЬ КОД"}
              </button>
            </div>

            {/* Players list */}
            <div className="w-full space-y-2">
              <div className="text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
                ИГРОКИ В КОМНАТЕ ({players.length}/4)
              </div>
              {players.length === 0 && (
                <div className="text-xs text-center py-3" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "Golos Text, sans-serif" }}>
                  Ожидание игроков...
                </div>
              )}
              {players.map(p => {
                const isMe = p.player_id === playerId.current;
                return (
                  <div key={p.player_id} className="flex items-center gap-3 p-3"
                    style={{ background: isMe ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${isMe ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}` }}>
                    <div className="rounded-full" style={{ width: 12, height: 12, background: p.char_color, flexShrink: 0 }} />
                    <span className="text-xs tracking-widest" style={{ color: p.char_color }}>{p.char_name}</span>
                    {isMe && <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Golos Text, sans-serif" }}>ВЫ</span>}
                  </div>
                );
              })}
              {/* Empty slots */}
              {Array.from({ length: Math.max(0, 3 - players.length + 1) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-3 p-3"
                  style={{ background: "rgba(255,255,255,0.01)", border: "1px dashed rgba(255,255,255,0.04)" }}>
                  <div className="rounded-full" style={{ width: 12, height: 12, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                  <span className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.1)" }}>СЛОТ {players.length + i + 1}</span>
                </div>
              ))}
            </div>

            <button onClick={startGame} className="w-full py-4 text-sm font-bold tracking-[0.3em] uppercase"
              style={{ background: "rgba(255,255,255,0.9)", color: "#0d0d0f", cursor: "pointer" }}
            >
              НАЧАТЬ ИГРУ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
