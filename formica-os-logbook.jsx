import { useState } from "react";

const FOUND_DATE = new Date("2026-05-27");

function daysSince(from) {
  const now = new Date();
  return Math.floor((now - from) / (1000 * 60 * 60 * 24));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(date) {
  return date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Milestones at ~23°C ambient
const MILESTONES = [
  { id: "queen_found",   label: "Königin gefunden",      day: 0,       icon: "♛",  status: "done" },
  { id: "eggs",          label: "Erste Eier erwartet",   day: 7,       icon: "⬤",  status: "pending" },
  { id: "larvae_l1",     label: "L1-Larven erwartet",    day: 35,      icon: "◑",  status: "pending" },
  { id: "larvae_l3",     label: "L3-Larven erwartet",    day: 56,      icon: "◕",  status: "pending" },
  { id: "pupae",         label: "Erste Puppen erwartet", day: 84,      icon: "○",  status: "pending" },
  { id: "nanitic",       label: "Erste Nanitics erwartet",day: 112,    icon: "✦",  status: "pending" },
  { id: "minors",        label: "Minor Workers",         day: 150,     icon: "✧",  status: "pending" },
  { id: "diapause",      label: "Diapause (Garage)",     day: 160,     icon: "❄",  status: "future" },
];

const LOG_ENTRIES_INIT = [
  {
    id: 1,
    date: "27.05.2026",
    day: 0,
    title: "Kolonie-Gründung — Tag 0",
    body: "Königin gefunden in Marly, Schweiz. Vermutlich frisch geflogen (Flügel abgeworfen). Reagenzglas-Setup. Platzierung: Büro, dunkle Ecke. Ambient ~23 °C.",
    tags: ["Gründung", "Reagenzglas"],
    params: { temp: 23, humidity: null },
  },
];

const STATUS_COLOR = {
  done: "#4ade80",
  pending: "#facc15",
  future: "#60a5fa",
  overdue: "#f87171",
};

export default function FormicariumLog() {
  const [entries, setEntries] = useState(LOG_ENTRIES_INIT);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", tags: "", temp: "", humidity: "" });
  const [activeTab, setActiveTab] = useState("log");

  const day = daysSince(FOUND_DATE);

  function getMilestoneStatus(m) {
    if (m.status === "done") return "done";
    if (m.status === "future") return "future";
    if (day > m.day + 7) return "overdue";
    if (day >= m.day) return "pending";
    return "pending";
  }

  function submitEntry() {
    if (!form.title || !form.body) return;
    const newEntry = {
      id: entries.length + 1,
      date: new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }),
      day,
      title: form.title,
      body: form.body,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()) : [],
      params: { temp: form.temp ? Number(form.temp) : null, humidity: form.humidity ? Number(form.humidity) : null },
    };
    setEntries([...entries, newEntry]);
    setForm({ title: "", body: "", tags: "", temp: "", humidity: "" });
    setShowForm(false);
  }

  const nextMilestone = MILESTONES.find(m => m.status !== "done" && m.day > day);
  const daysToNext = nextMilestone ? nextMilestone.day - day : null;

  return (
    <div style={{
      fontFamily: "'Courier New', 'Lucida Console', monospace",
      background: "#0a0f0a",
      color: "#c8e6c9",
      minHeight: "100vh",
      padding: "24px",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #2d4a2d", paddingBottom: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "16px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: "#4caf50", letterSpacing: "4px", textTransform: "uppercase" }}>
            FORMICA-OS v1.0
          </span>
          <span style={{ fontSize: "11px", color: "#557755" }}>// Colony Development Log</span>
        </div>
        <h1 style={{ margin: "8px 0 4px", fontSize: "22px", fontWeight: "bold", color: "#81c784", letterSpacing: "1px" }}>
          ♛ Camponotus ligniperda
        </h1>
        <div style={{ fontSize: "11px", color: "#66a166", display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <span>FUNDORT: Marly, CH</span>
          <span>DATUM: {fmt(FOUND_DATE)}</span>
          <span style={{ color: "#4ade80", fontWeight: "bold" }}>T+{day} TAGE</span>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        background: "#0e1a0e",
        border: "1px solid #2d4a2d",
        borderRadius: "4px",
        padding: "12px 16px",
        marginBottom: "20px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "12px",
      }}>
        {[
          { label: "STATUS", value: "GRÜNDUNGSPHASE", color: "#4ade80" },
          { label: "KOLONIE-TAG", value: `T+${day}`, color: "#facc15" },
          { label: "NÄCHSTER MEILENSTEIN", value: nextMilestone ? nextMilestone.label : "—", color: "#60a5fa" },
          { label: "IN", value: daysToNext !== null ? `${daysToNext} Tagen` : "—", color: "#f9a825" },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: "9px", color: "#557755", letterSpacing: "2px" }}>{s.label}</div>
            <div style={{ fontSize: "13px", color: s.color, fontWeight: "bold", marginTop: "2px" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px" }}>
        {[["log", "// LOGBUCH"], ["milestones", "// MEILENSTEINE"], ["params", "// PARAMETER"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            background: activeTab === id ? "#1b3a1b" : "transparent",
            border: `1px solid ${activeTab === id ? "#4caf50" : "#2d4a2d"}`,
            color: activeTab === id ? "#81c784" : "#557755",
            padding: "6px 14px",
            fontSize: "11px",
            cursor: "pointer",
            borderRadius: "3px",
            letterSpacing: "1px",
            fontFamily: "inherit",
          }}>{label}</button>
        ))}
      </div>

      {/* TAB: LOG */}
      {activeTab === "log" && (
        <div>
          {[...entries].reverse().map(entry => (
            <div key={entry.id} style={{
              borderLeft: "2px solid #2d6a2d",
              paddingLeft: "16px",
              marginBottom: "20px",
              position: "relative",
            }}>
              <div style={{
                position: "absolute", left: "-6px", top: "4px",
                width: "10px", height: "10px", borderRadius: "50%",
                background: "#4caf50", border: "2px solid #0a0f0a"
              }} />
              <div style={{ display: "flex", gap: "12px", alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "#4caf50", fontWeight: "bold" }}>{entry.date}</span>
                <span style={{ fontSize: "10px", color: "#557755" }}>T+{entry.day}</span>
                {entry.params.temp && <span style={{ fontSize: "10px", color: "#ff8f00" }}>🌡 {entry.params.temp}°C</span>}
                {entry.params.humidity && <span style={{ fontSize: "10px", color: "#29b6f6" }}>💧 {entry.params.humidity}%</span>}
              </div>
              <div style={{ fontSize: "14px", color: "#a5d6a7", fontWeight: "bold", margin: "4px 0 6px" }}>{entry.title}</div>
              <div style={{ fontSize: "12px", color: "#7cb97c", lineHeight: "1.6" }}>{entry.body}</div>
              {entry.tags.length > 0 && (
                <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                  {entry.tags.map(t => (
                    <span key={t} style={{
                      fontSize: "9px", background: "#1b3a1b", color: "#66a166",
                      padding: "2px 8px", borderRadius: "2px", letterSpacing: "1px",
                    }}>{t.toUpperCase()}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Add Entry */}
          {!showForm ? (
            <button onClick={() => setShowForm(true)} style={{
              background: "transparent", border: "1px dashed #2d6a2d", color: "#557755",
              padding: "10px 20px", cursor: "pointer", fontFamily: "inherit",
              fontSize: "12px", borderRadius: "3px", width: "100%", marginTop: "8px",
            }}>+ NEUER LOG-EINTRAG</button>
          ) : (
            <div style={{ background: "#0e1a0e", border: "1px solid #2d4a2d", borderRadius: "4px", padding: "16px", marginTop: "8px" }}>
              <div style={{ fontSize: "10px", color: "#4caf50", letterSpacing: "2px", marginBottom: "12px" }}>// NEUER EINTRAG — T+{day}</div>
              {[
                { key: "title", label: "TITEL", type: "text" },
                { key: "body", label: "BEOBACHTUNG", type: "textarea" },
                { key: "tags", label: "TAGS (komma-getrennt)", type: "text" },
                { key: "temp", label: "TEMPERATUR (°C)", type: "number" },
                { key: "humidity", label: "LUFTFEUCHTIGKEIT (%)", type: "number" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "9px", color: "#557755", letterSpacing: "2px", marginBottom: "4px" }}>{f.label}</div>
                  {f.type === "textarea" ? (
                    <textarea value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      rows={3} style={{
                        width: "100%", background: "#060e06", border: "1px solid #2d4a2d",
                        color: "#c8e6c9", padding: "8px", fontFamily: "inherit", fontSize: "12px",
                        borderRadius: "3px", resize: "vertical", boxSizing: "border-box",
                      }} />
                  ) : (
                    <input type={f.type} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      style={{
                        width: "100%", background: "#060e06", border: "1px solid #2d4a2d",
                        color: "#c8e6c9", padding: "8px", fontFamily: "inherit", fontSize: "12px",
                        borderRadius: "3px", boxSizing: "border-box",
                      }} />
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={submitEntry} style={{
                  background: "#1b3a1b", border: "1px solid #4caf50", color: "#81c784",
                  padding: "8px 20px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", borderRadius: "3px",
                }}>SPEICHERN</button>
                <button onClick={() => setShowForm(false)} style={{
                  background: "transparent", border: "1px solid #2d4a2d", color: "#557755",
                  padding: "8px 20px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", borderRadius: "3px",
                }}>ABBRECHEN</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: MILESTONES */}
      {activeTab === "milestones" && (
        <div>
          <div style={{ fontSize: "10px", color: "#557755", marginBottom: "16px" }}>
            Berechnet bei ~23 °C Ambient // Toleranz ±14 Tage
          </div>
          {MILESTONES.map((m, i) => {
            const st = getMilestoneStatus(m);
            const targetDate = fmt(addDays(FOUND_DATE, m.day));
            const isPast = day >= m.day;
            return (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: "16px",
                padding: "12px 0",
                borderBottom: i < MILESTONES.length - 1 ? "1px solid #152015" : "none",
                opacity: m.status === "future" ? 0.55 : 1,
              }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  border: `2px solid ${STATUS_COLOR[st]}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", color: STATUS_COLOR[st], flexShrink: 0,
                  background: isPast ? "#0e1a0e" : "transparent",
                }}>{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", color: "#a5d6a7", fontWeight: "bold" }}>{m.label}</div>
                  <div style={{ fontSize: "10px", color: "#557755", marginTop: "2px" }}>
                    T+{m.day} // {targetDate}
                  </div>
                </div>
                <div style={{
                  fontSize: "10px", fontWeight: "bold", letterSpacing: "1px",
                  color: STATUS_COLOR[st],
                }}>{
                  st === "done" ? "✓ DONE" :
                  st === "overdue" ? "⚠ ÜBERFÄLLIG" :
                  st === "future" ? "SCHEDULED" :
                  day < m.day ? `in ${m.day - day}d` : "JETZT"
                }</div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: PARAMS */}
      {activeTab === "params" && (
        <div>
          <div style={{ fontSize: "10px", color: "#557755", marginBottom: "16px" }}>
            Zielparameter Gründungsphase // Reagenzglas-Setup
          </div>
          {[
            { label: "AMBIENT TEMPERATUR", value: "22–25 °C", ideal: "23 °C", color: "#ff8f00" },
            { label: "REAGENZGLAS FEUCHTE", value: "Wasser-Kolonne vorhanden", ideal: "passiv via Watte", color: "#29b6f6" },
            { label: "LICHT", value: "Dunkel", ideal: "0 lux direkt", color: "#ce93d8" },
            { label: "VIBRATION", value: "Minimal", ideal: "Büro-Setup OK", color: "#80cbc4" },
            { label: "STÖRUNGEN", value: "Max. 1×/Tag Kurzkontrolle", ideal: "Hands-off Doktrin", color: "#ef9a9a" },
            { label: "DIAPAUSE (geplant)", value: "Okt–Nov 2026", ideal: "8–12 °C, Garage", color: "#60a5fa" },
          ].map(p => (
            <div key={p.label} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px", padding: "10px 0",
              borderBottom: "1px solid #152015",
              alignItems: "center",
            }}>
              <div style={{ fontSize: "9px", color: "#557755", letterSpacing: "2px" }}>{p.label}</div>
              <div style={{ fontSize: "12px", color: p.color }}>{p.value}</div>
              <div style={{ fontSize: "11px", color: "#3d6e3d" }}>{p.ideal}</div>
            </div>
          ))}

          <div style={{ marginTop: "24px", background: "#0e1a0e", border: "1px solid #1b3a1b", borderRadius: "4px", padding: "14px" }}>
            <div style={{ fontSize: "9px", color: "#4caf50", letterSpacing: "3px", marginBottom: "8px" }}>// HARDWARE-ROADMAP</div>
            {[
              ["Phase 1", "Reagenzglas — manuell", "jetzt"],
              ["Phase 2", "Starter-Box mit ESP32 Temp/Humidity", "bei ersten Nanitics"],
              ["Phase 3", "Smart Formicarium mit HA-Integration", "nach Überwinterung"],
            ].map(([ph, desc, when]) => (
              <div key={ph} style={{ display: "flex", gap: "12px", padding: "4px 0", fontSize: "11px" }}>
                <span style={{ color: "#4caf50", minWidth: "60px" }}>{ph}</span>
                <span style={{ color: "#7cb97c", flex: 1 }}>{desc}</span>
                <span style={{ color: "#557755" }}>{when}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "32px", paddingTop: "12px", borderTop: "1px solid #152015", fontSize: "9px", color: "#2d4a2d", letterSpacing: "2px" }}>
        FORMICA-OS // C.LIGNIPERDA // MARLY CH // {fmt(FOUND_DATE)} // NILS_KEEPER
      </div>
    </div>
  );
}
