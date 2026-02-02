import React, { useMemo, useState } from "react";

/**
 * Blackjack Card Counting + Basic Strategy (S17, DAS, Late Surrender) trainer.
 *
 * Features
 * - Setup: players, decks
 * - Input: dealer upcard, visible table cards, your hand
 * - Output: Running Count (Hi-Lo), estimated decks remaining, True Count (TC)
 * - Advice: Stand/Hit/Double/Split/Surrender using baseline strategy + key deviations
 */

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function hiLoValue(rank) {
  if (["2", "3", "4", "5", "6"].includes(rank)) return +1;
  if (["7", "8", "9"].includes(rank)) return 0;
  return -1; // 10,J,Q,K,A
}

function isTenValue(rank) {
  return rank === "10" || rank === "J" || rank === "Q" || rank === "K";
}

function toDealerUpValue(rank) {
  if (rank === "A") return 11;
  if (isTenValue(rank)) return 10;
  return parseInt(rank, 10);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// ----- Hand evaluation -----
function bestTotal(ranks) {
  let total = 0;
  let aces = 0;
  for (const r of ranks) {
    if (r === "A") {
      aces += 1;
      total += 11;
    } else if (isTenValue(r)) {
      total += 10;
    } else {
      total += parseInt(r, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const aceCount = ranks.filter((r) => r === "A").length;
  const isSoft = aceCount > 0 && total <= 21 && aceCount > aces;
  return { total, isSoft };
}

function isPair(hand) {
  if (hand.length !== 2) return false;
  const [a, b] = hand;
  if (isTenValue(a) && isTenValue(b)) return true;
  return a === b;
}

function pairKey(hand) {
  const [a, b] = hand;
  if (isTenValue(a) && isTenValue(b)) return "10";
  return a;
}

// ----- Baseline: multi-deck S17 DAS LS (practical baseline) -----
function baselineAction(hand, dealerUp, opts) {
  const up = toDealerUpValue(dealerUp);
  const { total, isSoft } = bestTotal(hand);

  // Late Surrender baseline
  if (opts.canSurrender && hand.length === 2) {
    if (!isSoft && total === 16 && (up === 9 || up === 10 || up === 11)) return "Surrender";
    if (!isSoft && total === 15 && up === 10) return "Surrender";
  }

  // Pairs
  if (opts.canSplit && isPair(hand)) {
    const pk = pairKey(hand);
    if (pk === "A") return "Split";
    if (pk === "10") return "Stand";
    if (pk === "9") {
      if ([2, 3, 4, 5, 6, 8, 9].includes(up)) return "Split";
      return "Stand";
    }
    if (pk === "8") return "Split";
    if (pk === "7") {
      if (up >= 2 && up <= 7) return "Split";
      return "Hit";
    }
    if (pk === "6") {
      if (up >= 2 && up <= 6) return "Split";
      return "Hit";
    }
    if (pk === "5") {
      if (opts.canDouble && up >= 2 && up <= 9) return "Double";
      return "Hit";
    }
    if (pk === "4") {
      if (up === 5 || up === 6) return "Split";
      return "Hit";
    }
    if (pk === "3" || pk === "2") {
      if (up >= 2 && up <= 7) return "Split";
      return "Hit";
    }
  }

  // Soft totals
  if (isSoft) {
    if (total >= 20) return "Stand";
    if (total === 19) {
      if (opts.canDouble && up === 6) return "Double";
      return "Stand";
    }
    if (total === 18) {
      if (opts.canDouble && up >= 3 && up <= 6) return "Double";
      if (up === 2 || up === 7 || up === 8) return "Stand";
      return "Hit";
    }
    if (total === 17) {
      if (opts.canDouble && up >= 3 && up <= 6) return "Double";
      return "Hit";
    }
    if (total === 16 || total === 15) {
      if (opts.canDouble && up >= 4 && up <= 6) return "Double";
      return "Hit";
    }
    if (total === 14 || total === 13) {
      if (opts.canDouble && (up === 5 || up === 6)) return "Double";
      return "Hit";
    }
    return "Hit";
  }

  // Hard totals
  if (total >= 17) return "Stand";
  if (total <= 8) return "Hit";

  if (total === 9) {
    if (opts.canDouble && up >= 3 && up <= 6) return "Double";
    return "Hit";
  }
  if (total === 10) {
    if (opts.canDouble && up >= 2 && up <= 9) return "Double";
    return "Hit";
  }
  if (total === 11) {
    if (opts.canDouble && up >= 2 && up <= 10) return "Double";
    return up === 11 ? "Hit" : "Double";
  }
  if (total === 12) {
    if (up >= 4 && up <= 6) return "Stand";
    return "Hit";
  }
  if (total >= 13 && total <= 16) {
    if (up >= 2 && up <= 6) return "Stand";
    return "Hit";
  }
  return "Hit";
}

// ----- Key deviations (Hi-Lo TC) -----
function applyDeviations(base, hand, dealerUp, tc, opts) {
  const up = toDealerUpValue(dealerUp);
  const { total, isSoft } = bestTotal(hand);
  const notes = [];

  if (!isSoft && total === 16 && up === 10 && tc >= 0) {
    if (base !== "Stand") {
      notes.push("Deviation: 16 vs 10 → Stand at TC ≥ 0");
      return { action: "Stand", notes };
    }
  }
  if (!isSoft && total === 15 && up === 10 && tc >= 4) {
    if (base !== "Stand") {
      notes.push("Deviation: 15 vs 10 → Stand at TC ≥ +4");
      return { action: "Stand", notes };
    }
  }
  if (!isSoft && total === 16 && up === 9 && tc >= 5) {
    if (base !== "Stand") {
      notes.push("Deviation: 16 vs 9 → Stand at TC ≥ +5");
      return { action: "Stand", notes };
    }
  }
  if (!isSoft && total === 16 && up === 11 && tc >= 3) {
    if (base !== "Stand") {
      notes.push("Deviation: 16 vs A → Stand at TC ≥ +3");
      return { action: "Stand", notes };
    }
  }
  if (!isSoft && total === 12 && up === 3 && tc >= 1) {
    if (base !== "Stand") {
      notes.push("Deviation: 12 vs 3 → Stand at TC ≥ +1");
      return { action: "Stand", notes };
    }
  }
  if (!isSoft && total === 12 && up === 2 && tc >= 3) {
    if (base !== "Stand") {
      notes.push("Deviation: 12 vs 2 → Stand at TC ≥ +3");
      return { action: "Stand", notes };
    }
  }
  if (opts.canDouble && !isSoft && total === 10 && up === 10 && tc >= 4) {
    if (base !== "Double") {
      notes.push("Deviation: 10 vs 10 → Double at TC ≥ +4");
      return { action: "Double", notes };
    }
  }
  if (opts.canDouble && !isSoft && total === 10 && up === 11 && tc >= 3) {
    if (base !== "Double") {
      notes.push("Deviation: 10 vs A → Double at TC ≥ +3");
      return { action: "Double", notes };
    }
  }
  if (opts.canDouble && !isSoft && total === 11 && up === 11 && tc >= 0) {
    if (base !== "Double") {
      notes.push("Deviation: 11 vs A → Double at TC ≥ 0");
      return { action: "Double", notes };
    }
  }

  return { action: base, notes };
}

function Badge({ children }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      border: "1px solid #ddd",
      borderRadius: 999,
      padding: "2px 8px",
      fontSize: 12,
      fontWeight: 600
    }}>
      {children}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      border: "1px solid #e5e5e5",
      borderRadius: 16,
      background: "white",
      padding: 16
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CardPicker({ onPick }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
      {RANKS.map((r) => (
        <button
          key={r}
          onClick={() => onPick(r)}
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "white",
            padding: "10px 8px",
            fontWeight: 700,
            cursor: "pointer"
          }}
          title={`Add ${r}`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function formatCards(cards) {
  if (cards.length === 0) return "(none)";
  return cards.join(" ");
}

export default function App() {
  const [stage, setStage] = useState("setup");
  const [players, setPlayers] = useState(4);
  const [decks, setDecks] = useState(2);

  const [dealerUp, setDealerUp] = useState("10");
  const [seen, setSeen] = useState([]);
  const [myHand, setMyHand] = useState([]);

  const totalCards = useMemo(() => decks * 52, [decks]);

  const runningCount = useMemo(() => seen.reduce((s, r) => s + hiLoValue(r), 0), [seen]);

  const decksRemaining = useMemo(() => {
    const remainingCards = totalCards - seen.length;
    const est = remainingCards / 52;
    return clamp(est, 0.25, decks);
  }, [totalCards, seen.length, decks]);

  const trueCount = useMemo(() => {
    const tc = runningCount / decksRemaining;
    return tc < 0 ? Math.ceil(tc) : Math.floor(tc); // truncate toward 0
  }, [runningCount, decksRemaining]);

  const { total: myTotal, isSoft: mySoft } = useMemo(() => bestTotal(myHand), [myHand]);

  const baseline = useMemo(() => {
    if (!dealerUp) return null;
    return baselineAction(myHand, dealerUp, {
      canSplit: true,
      canDouble: myHand.length === 2,
      canSurrender: myHand.length === 2,
    });
  }, [myHand, dealerUp]);

  const recommendation = useMemo(() => {
    if (!dealerUp || !baseline) return null;
    const canDouble = myHand.length === 2;
    const canSurrender = myHand.length === 2;
    const applied = applyDeviations(baseline, myHand, dealerUp, trueCount, { canDouble, canSurrender });
    const insurance = dealerUp === "A" ? (trueCount >= 3 ? "Buy (TC ≥ +3)" : "Do not buy") : "N/A";
    return { base: baseline, final: applied.action, notes: applied.notes, insurance };
  }, [dealerUp, baseline, myHand, trueCount]);

  function resetPlay() {
    setSeen([]);
    setMyHand([]);
    setDealerUp("10");
  }

  function start() {
    resetPlay();
    setStage("play");
  }

  function addSeen(r) {
    setSeen((prev) => [...prev, r]);
  }

  function addMy(r) {
    setMyHand((prev) => [...prev, r]);
    setSeen((prev) => [...prev, r]); // auto-count your cards as seen
  }

  function undoSeen() {
    setSeen((prev) => prev.slice(0, -1));
  }

  function undoMy() {
    setMyHand((prev) => {
      if (prev.length === 0) return prev;
      setSeen((s) => s.slice(0, -1));
      return prev.slice(0, -1);
    });
  }

  const setupValid = players >= 1 && players <= 7 && decks >= 1 && decks <= 8;

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", padding: 24 }}>
      <div style={{ maxWidth: 1024, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e5e5", padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>21點算牌教學網站（Hi-Lo）</h1>
              <p style={{ margin: "6px 0 0", fontSize: 14, color: "#444" }}>
                輸入玩家數與幾副牌，記錄桌面可見牌與你的手牌，即時計算 RC/TC 並給出建議動作（S/H/D/P/R）。
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge>S17</Badge>
              <Badge>LS</Badge>
              <Badge>DAS</Badge>
            </div>
          </div>
        </div>

        {stage === "setup" ? (
          <Section title="起始設定">
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>玩家數量（含你，不含莊家）</label>
                <input
                  style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
                  type="number"
                  min={1}
                  max={7}
                  value={players}
                  onChange={(e) => setPlayers(parseInt(e.target.value || "0", 10))}
                />
                <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                  玩家數主要是情境資訊；TC 計算取決於牌副數與已出牌。
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>幾副牌（Decks）</label>
                <input
                  style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
                  type="number"
                  min={1}
                  max={8}
                  value={decks}
                  onChange={(e) => setDecks(parseInt(e.target.value || "0", 10))}
                />
                <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>例如：雙副牌填 2。</div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={start}
                disabled={!setupValid}
                style={{
                  border: "none",
                  background: "black",
                  color: "white",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: setupValid ? "pointer" : "not-allowed",
                  opacity: setupValid ? 1 : 0.5
                }}
              >
                進入遊戲
              </button>
              <div style={{ fontSize: 12, color: "#666" }}>
                提醒：這個工具用「常見的 S17 + 可投降 + 可DAS」baseline + 少量核心偏離點。
              </div>
            </div>
          </Section>
        ) : (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Section title="步驟 1：選擇莊家明牌（Upcard）">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {RANKS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setDealerUp(r)}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: 12,
                        padding: "8px 10px",
                        background: dealerUp === r ? "#111" : "white",
                        color: dealerUp === r ? "white" : "black",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                  你若要精確計入莊家明牌，請在「桌面可見牌」也加一次該牌。
                </div>
              </Section>

              <Section title="步驟 2：加入桌面可見牌（含其他玩家、已開出的牌）">
                <CardPicker onPick={addSeen} />
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={undoSeen} style={{ border: "1px solid #ddd", borderRadius: 12, padding: "8px 10px", background: "white", fontWeight: 700 }}>
                    Undo（桌面）
                  </button>
                  <button onClick={() => setSeen([])} style={{ border: "1px solid #ddd", borderRadius: 12, padding: "8px 10px", background: "white", fontWeight: 700 }}>
                    Clear（桌面）
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 14, color: "#333" }}>
                  已加入桌面牌： <span style={{ fontWeight: 800 }}>{formatCards(seen)}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                  這裡的牌會用來計算 RC/TC。你的手牌加入時會自動算入 seen。
                </div>
              </Section>

              <Section title="步驟 3：輸入我的手牌">
                <CardPicker onPick={addMy} />
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={undoMy} style={{ border: "1px solid #ddd", borderRadius: 12, padding: "8px 10px", background: "white", fontWeight: 700 }}>
                    Undo（我的手牌）
                  </button>
                  <button onClick={() => setMyHand([])} style={{ border: "1px solid #ddd", borderRadius: 12, padding: "8px 10px", background: "white", fontWeight: 700 }}>
                    Clear（我的手牌）
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 14, color: "#333" }}>
                  我的手牌： <span style={{ fontWeight: 800 }}>{formatCards(myHand)}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                  Double / Surrender 只會在兩張起手牌時出現。
                </div>
              </Section>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Section title="即時計數結果（Hi-Lo）">
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                  <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, padding: 12, background: "white" }}>
                    <div style={{ fontSize: 12, color: "#666" }}>Running Count (RC)</div>
                    <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>
                      {runningCount >= 0 ? `+${runningCount}` : runningCount}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>2–6:+1，7–9:0，10/A:-1</div>
                  </div>

                  <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, padding: 12, background: "white" }}>
                    <div style={{ fontSize: 12, color: "#666" }}>Decks Remaining（估計）</div>
                    <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{decksRemaining.toFixed(2)}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>（總張數−已見張數）/52</div>
                  </div>

                  <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, padding: 12, background: "white" }}>
                    <div style={{ fontSize: 12, color: "#666" }}>True Count (TC)</div>
                    <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>
                      {trueCount >= 0 ? `+${trueCount}` : trueCount}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>TC = RC ÷ 剩餘副數（向 0 截斷）</div>
                  </div>

                  <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, padding: 12, background: "white" }}>
                    <div style={{ fontSize: 12, color: "#666" }}>已見牌張數</div>
                    <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{seen.length} / {totalCards}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>越接近尾端，TC 越敏感</div>
                  </div>
                </div>

                <div style={{ marginTop: 10, border: "1px solid #e5e5e5", borderRadius: 16, padding: 12, background: "white" }}>
                  <div style={{ fontSize: 12, color: "#666" }}>我的手牌狀態</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge>Total: {myTotal}</Badge>
                    <Badge>{mySoft ? "Soft" : "Hard"}</Badge>
                    <Badge>{isPair(myHand) ? "Pair" : "Not a Pair"}</Badge>
                  </div>
                </div>
              </Section>

              <Section title="建議動作（Basic Strategy + 核心偏離點）">
                {myHand.length === 0 ? (
                  <div style={{ fontSize: 14, color: "#444" }}>請輸入你的手牌。</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, padding: 12, background: "white" }}>
                      <div style={{ fontSize: 12, color: "#666" }}>建議</div>
                      <div style={{ fontSize: 30, fontWeight: 950, marginTop: 4 }}>{recommendation?.final ?? "—"}</div>
                      <div style={{ marginTop: 6, fontSize: 14, color: "#333" }}>
                        Baseline：<b>{recommendation?.base ?? "—"}</b>
                      </div>
                      {recommendation?.notes?.length ? (
                        <ul style={{ marginTop: 8, paddingLeft: 18, color: "#333" }}>
                          {recommendation.notes.map((n) => (
                            <li key={n} style={{ marginTop: 4 }}>{n}</li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>（本局面沒有觸發核心偏離點）</div>
                      )}
                    </div>

                    <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, padding: 12, background: "white" }}>
                      <div style={{ fontSize: 12, color: "#666" }}>保險（Insurance）</div>
                      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800 }}>{recommendation?.insurance}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>常用門檻：TC ≥ +3 才買保險</div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={resetPlay}
                    style={{ border: "1px solid #ddd", borderRadius: 12, padding: "8px 10px", background: "white", fontWeight: 700 }}
                  >
                    清空本局
                  </button>
                  <button
                    onClick={() => setStage("setup")}
                    style={{ border: "1px solid #ddd", borderRadius: 12, padding: "8px 10px", background: "white", fontWeight: 700 }}
                  >
                    回起始頁
                  </button>
                </div>
              </Section>
            </div>
          </div>
        )}

        <div style={{ paddingBottom: 18, textAlign: "center", fontSize: 12, color: "#777" }}>
          教學/練習用：輸出基於常見 S17 + LS + DAS 的 baseline 與少量核心偏離點，並非涵蓋所有賭場規則。
        </div>
      </div>
    </div>
  );
}

