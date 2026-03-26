import { useState } from "react";
import Icon from "@/components/ui/icon";

const CLANS = [
  {
    tag: "VOID",
    name: "Пустота",
    color: "#00ffaa",
    members: 24,
    maxMembers: 30,
    rank: 1,
    score: 485200,
    wins: 1820,
    desc: "Элитный клан теней. Принимаем только сильнейших.",
    minLevel: 20,
    open: false,
    members_list: ["SHADOWBANE", "VXLOID", "PULSAR", "AXIOM", "DRIFT"],
  },
  {
    tag: "NEXUS",
    name: "Нексус",
    color: "#aa44ff",
    members: 18,
    maxMembers: 25,
    rank: 2,
    score: 312400,
    wins: 1240,
    desc: "Командная игра превыше всего. Вместе непобедимы.",
    minLevel: 10,
    open: true,
    members_list: ["NEONKNIGHT", "BLITZ99", "PULSE", "SYNTH", "VERTEX"],
  },
  {
    tag: "APEX",
    name: "Апекс",
    color: "#ff3366",
    members: 15,
    maxMembers: 20,
    rank: 3,
    score: 198700,
    wins: 890,
    desc: "Агрессивный стиль, максимальный урон. Без пощады.",
    minLevel: 15,
    open: true,
    members_list: ["GRAVEDAD", "IRONFIST", "REAPER", "NOVA", "CRASH"],
  },
  {
    tag: "ECHO",
    name: "Эхо",
    color: "#33aaff",
    members: 8,
    maxMembers: 20,
    rank: 4,
    score: 87300,
    wins: 420,
    desc: "Новый клан для тех, кто только начинает путь.",
    minLevel: 1,
    open: true,
    members_list: ["SPECTRE", "CODA", "VALE", "MIST"],
  },
];

interface Props {
  playerName: string;
  level: number;
}

export default function ClanSystem({ playerName, level }: Props) {
  const [view, setView] = useState<"list" | "detail" | "create">("list");
  const [selectedClan, setSelectedClan] = useState<typeof CLANS[0] | null>(null);
  const [myClan] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createTag, setCreateTag] = useState("");

  if (view === "create") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button onClick={() => setView("list")} className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
          <Icon name="ArrowLeft" size={14} /> Назад
        </button>
        <h2 className="text-3xl font-black tracking-wide mb-6" style={{ fontFamily: "Oswald", color: "white" }}>
          СОЗДАТЬ КЛАН
        </h2>
        <div className="space-y-4 rounded-sm border border-white/10 p-6" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-2" style={{ fontFamily: "Oswald" }}>
              Название клана
            </label>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Напр: Теневой отряд"
              className="w-full px-3 py-2 text-sm text-white outline-none border border-white/10 focus:border-white/30 transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", fontFamily: "Golos Text" }}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-2" style={{ fontFamily: "Oswald" }}>
              Тег (2-5 символов)
            </label>
            <input
              value={createTag}
              onChange={(e) => setCreateTag(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="CLAN"
              className="w-full px-3 py-2 text-sm text-white outline-none border border-white/10 focus:border-white/30 transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", fontFamily: "Oswald" }}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-2" style={{ fontFamily: "Oswald" }}>
              Цвет клана
            </label>
            <div className="flex gap-3">
              {["#00ffaa", "#aa44ff", "#ff3366", "#33aaff", "#ff8833", "#ffffff"].map((c) => (
                <button
                  key={c}
                  className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                  style={{ background: c, borderColor: "transparent" }}
                />
              ))}
            </div>
          </div>
          <button
            className="w-full py-3 text-sm font-bold uppercase tracking-widest mt-2 transition-all hover:scale-[1.02]"
            style={{ fontFamily: "Oswald", background: "var(--neon-green)", color: "#0a0a0a" }}
          >
            Основать клан
          </button>
          <p className="text-xs text-white/25 text-center">Стоимость: 500 очков рейтинга</p>
        </div>
      </div>
    );
  }

  if (view === "detail" && selectedClan) {
    const clan = selectedClan;
    const canJoin = level >= clan.minLevel && clan.open;
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={() => setView("list")} className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
          <Icon name="ArrowLeft" size={14} /> Назад к кланам
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-sm border p-6 mb-4" style={{ background: `${clan.color}06`, borderColor: `${clan.color}30` }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs px-2 py-0.5 font-bold" style={{ fontFamily: "Oswald", background: clan.color, color: "#0a0a0a" }}>
                      [{clan.tag}]
                    </span>
                    <span className="text-xs text-white/30">Ранг #{clan.rank}</span>
                    {clan.open ? (
                      <span className="text-xs text-green-400 flex items-center gap-1"><Icon name="Unlock" size={10} /> Открыт</span>
                    ) : (
                      <span className="text-xs text-white/30 flex items-center gap-1"><Icon name="Lock" size={10} /> Закрыт</span>
                    )}
                  </div>
                  <h3 className="text-3xl font-black tracking-wide" style={{ fontFamily: "Oswald", color: clan.color }}>
                    {clan.name}
                  </h3>
                </div>
              </div>
              <p className="text-white/50 text-sm mb-6">{clan.desc}</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Очков", value: clan.score.toLocaleString() },
                  { label: "Побед", value: clan.wins.toLocaleString() },
                  { label: "Мин. уровень", value: clan.minLevel.toString() },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 rounded-sm" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="text-lg font-black text-white" style={{ fontFamily: "Oswald" }}>{s.value}</div>
                    <div className="text-xs text-white/40">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              disabled={!canJoin}
              className="w-full py-3 text-sm font-bold uppercase tracking-widest transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                fontFamily: "Oswald",
                background: canJoin ? clan.color : "rgba(255,255,255,0.05)",
                color: canJoin ? "#0a0a0a" : "rgba(255,255,255,0.3)",
              }}
            >
              {!clan.open ? "🔒 Клан закрыт" : level < clan.minLevel ? `🔒 Нужен уровень ${clan.minLevel}` : "Вступить в клан"}
            </button>
          </div>

          <div className="rounded-sm border border-white/10 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs uppercase tracking-widest text-white/40" style={{ fontFamily: "Oswald" }}>Участники</h4>
              <span className="text-xs text-white/30">{clan.members}/{clan.maxMembers}</span>
            </div>
            <div className="stat-bar mb-4">
              <div className="stat-bar-fill" style={{ width: `${(clan.members / clan.maxMembers) * 100}%`, background: clan.color }} />
            </div>
            {clan.members_list.map((name, i) => (
              <div key={name} className="flex items-center gap-3 py-2 border-b border-white/5">
                <span className="text-xs text-white/30 w-4">{i + 1}</span>
                <div className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-bold" style={{ background: `${clan.color}20`, color: clan.color, fontFamily: "Oswald" }}>
                  {name[0]}
                </div>
                <span className="text-xs text-white/70" style={{ fontFamily: "Oswald" }}>{name}</span>
                {i === 0 && <span className="text-xs ml-auto" style={{ color: clan.color }}>Лидер</span>}
              </div>
            ))}
            <p className="text-xs text-white/20 mt-3 text-center">+{clan.members - clan.members_list.length} других</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-wide mb-1" style={{ fontFamily: "Oswald", color: "white" }}>
            КЛАНЫ
          </h2>
          <p className="text-white/40 text-sm">Объединяйтесь и сражайтесь вместе</p>
        </div>
        <button
          onClick={() => setView("create")}
          className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all hover:scale-105"
          style={{ fontFamily: "Oswald", background: "rgba(0,255,170,0.1)", color: "var(--neon-green)", border: "1px solid rgba(0,255,170,0.25)" }}
        >
          + Создать клан
        </button>
      </div>

      {/* My clan banner */}
      {!myClan && (
        <div
          className="mb-6 p-4 rounded-sm border border-white/8 flex items-center gap-4"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <Icon name="Shield" size={20} className="text-white/20" />
          <div>
            <div className="text-sm text-white/60">Вы не состоите в клане</div>
            <div className="text-xs text-white/30">Вступите в существующий или создайте свой</div>
          </div>
        </div>
      )}

      {/* Clan grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CLANS.map((clan) => (
          <button
            key={clan.tag}
            onClick={() => { setSelectedClan(clan); setView("detail"); }}
            className="text-left rounded-sm border p-5 transition-all duration-200 hover:border-white/20"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-sm flex items-center justify-center font-black text-sm"
                  style={{ fontFamily: "Oswald", background: `${clan.color}15`, color: clan.color }}
                >
                  {clan.tag[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white" style={{ fontFamily: "Oswald" }}>{clan.name}</span>
                    <span className="text-xs px-1.5 py-0.5" style={{ background: `${clan.color}20`, color: clan.color, fontFamily: "Oswald" }}>
                      [{clan.tag}]
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/30 mt-0.5">
                    <span className="flex items-center gap-1"><Icon name="Users" size={10} /> {clan.members}/{clan.maxMembers}</span>
                    <span>Ранг #{clan.rank}</span>
                    {clan.open
                      ? <span className="text-green-400/60">Открыт</span>
                      : <span className="text-white/20">Закрыт</span>
                    }
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-white" style={{ fontFamily: "Oswald" }}>
                  {clan.score.toLocaleString()}
                </div>
                <div className="text-xs text-white/30">очков</div>
              </div>
            </div>

            <p className="text-xs text-white/40 mb-3 leading-relaxed">{clan.desc}</p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {clan.members_list.slice(0, 4).map((name) => (
                  <div
                    key={name}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: `${clan.color}20`, color: clan.color, fontFamily: "Oswald" }}
                  >
                    {name[0]}
                  </div>
                ))}
                {clan.members > 4 && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white/30" style={{ background: "rgba(255,255,255,0.05)" }}>
                    +{clan.members - 4}
                  </div>
                )}
              </div>
              <span className="text-xs text-white/30 flex items-center gap-1">
                Подробнее <Icon name="ChevronRight" size={12} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
