// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Buy-or-Not — with sticky right-side Decision Summary
 * - Two-column layout (left: inputs, right: sticky summary)
 * - All your previous logic (resale, wait, per-use, minimalism, weights, history)
 * - Polished UI using Tailwind utility classes (card, btn-*)
 *
 * Note: for best look, add the small helpers in src/index.css from earlier:
 * .card, .btn, .btn-primary, .btn-ghost, .btn-danger, .eyebrow, shadow-soft, etc.
 */

// ---------- Helpers ----------
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const currency = (n: number) =>
  isFinite(n)
    ? n.toLocaleString(undefined, { style: "currency", currency: "CAD" })
    : "—";
const pct = (n: number) => `${Math.round(n)}%`;

// ---------- Presets ----------
const CONDITION_PRESETS = [
  { key: "new", label: "New (unopened)", probMult: 1.0, priceMult: 1.0 },
  { key: "like_new", label: "Like New", probMult: 1.05, priceMult: 0.95 },
  { key: "good", label: "Good", probMult: 1.0, priceMult: 0.9 },
  { key: "fair", label: "Fair", probMult: 0.85, priceMult: 0.8 },
  { key: "poor", label: "Poor", probMult: 0.7, priceMult: 0.65 },
] as const;

const DEMAND_PRESETS = [
  { key: "high", label: "High demand", probMult: 1.15, timeHoursAdd: -0.5 },
  { key: "medium", label: "Medium", probMult: 1.0, timeHoursAdd: 0 },
  { key: "low", label: "Low demand", probMult: 0.8, timeHoursAdd: 0.75 },
] as const;

// ---------- Reusable UI ----------
function Section({
  title,
  children,
  subtitle,
}: {
  title: string;
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="card p-5 space-y-3 border border-slate-200">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function LabeledNumber({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      <input
        type="number"
        className="mt-1 w-full rounded-xl border-slate-200 focus:border-slate-400 focus:ring-0"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  suffixFn = (v: number) => String(v),
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffixFn?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">{suffixFn(value)}</span>
      </div>
      <input
        type="range"
        className="mt-2 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      <button
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-slate-900" : "bg-slate-300"
        }`}
        onClick={() => onChange(!checked)}
        type="button"
        aria-pressed={checked}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      <select
        className="mt-1 w-full rounded-xl border-slate-200 focus:border-slate-400 focus:ring-0 bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pill({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green" | "yellow" | "red" | "blue";
}) {
  const tones: Record<string, string> = {
    gray: "bg-slate-100 text-slate-800",
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">{v}/100</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-slate-900 to-slate-600"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 text-xs px-2 py-1">
      {children}
    </span>
  );
}

// ---------- Decision Summary (Sticky Sidebar) ----------
function DecisionSummary(props: {
  verdictLabel: string;
  decisionScore: number;
  stickerCost: number;
  effectiveCost: number;
  resaleOffset: number;
  costPerUse: number;
  sensitivity: {
    current: number;
    noResale: number;
    bestResale: number;
    waitSale: number | null;
  };
  simulateWait: boolean;
  monthsToWait: number;
  targetDiscountPct: number;

  budgetImpact: number;
  useFrequency: number;
  longevity: number;
  price: number;
  taxFor: (p: number) => number;
  needLevel: number;
  joyScore: number;
  workRelated: boolean;
  resaleAggressive: boolean;
  altAvailable: number;
  returnPolicy: number;
  warranty: number;
  spaceFit: number;
  urgency: number;
  keepOldItem: boolean;
  minimalismStrength: number;
}) {
  const {
    verdictLabel,
    decisionScore,
    stickerCost,
    effectiveCost,
    resaleOffset,
    costPerUse,
    sensitivity,
    simulateWait,
    monthsToWait,
    targetDiscountPct,
    budgetImpact,
    useFrequency,
    longevity,
    price,
    taxFor,
    needLevel,
    joyScore,
    workRelated,
    resaleAggressive,
    altAvailable,
    returnPolicy,
    warranty,
    spaceFit,
    urgency,
    keepOldItem,
    minimalismStrength,
  } = props;

  // Intuitive driver values (0-100) for display
  const affordability = clamp(100 - budgetImpact * 10);
  const usage = clamp(useFrequency * 8 + longevity * 4);
  const priceDrag = clamp(100 - (effectiveCost / Math.max(1, price)) * 50);
  const resaleStrength = clamp((resaleOffset / Math.max(1, stickerCost)) * 100);
  const need = needLevel * 10;
  const joy = joyScore * 10;
  const freq = useFrequency * 8;
  const work = workRelated ? 100 : 0;
  const returns = returnPolicy * 10;
  const warr = warranty * 8;
  const space = spaceFit * 8;
  const alternatives = clamp(100 - altAvailable * 7);
  const urg = urgency * 6;

  return (
    <aside className="sticky top-4">
      <section className="card p-6 space-y-5">
        <div>
          <div className="text-sm text-slate-500 mb-1">Decision</div>
          <div className="flex items-center gap-3">
            <div className="text-3xl font-extrabold tracking-tight">
              {verdictLabel}
            </div>
            <Chip>{decisionScore}/100</Chip>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Sticker:{" "}
            <span className="font-medium">{currency(stickerCost)}</span> •
            Effective:{" "}
            <span className="font-medium">{currency(effectiveCost)}</span>{" "}
            <span className="text-slate-400">
              (offset {currency(resaleOffset)})
            </span>
          </p>
          <p className="text-sm text-slate-500">
            Cost per use:{" "}
            <span className="font-medium">{currency(costPerUse)}</span>{" "}
            <span className="text-slate-400">
              (tax {currency(taxFor(price))})
            </span>
          </p>
          {simulateWait && (
            <p className="text-sm text-slate-500 mt-1">
              Wait <span className="font-medium">{monthsToWait} mo</span> @{" "}
              <span className="font-medium">−{targetDiscountPct}%</span> → score{" "}
              <span className="font-medium">{sensitivity.waitSale}</span>
            </p>
          )}
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-sm font-medium text-slate-700 mb-2">
            Sensitivity
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Now</span>
              <span className="font-semibold">{sensitivity.current}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>No resale</span>
              <span className="font-semibold">{sensitivity.noResale}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Best-case resale</span>
              <span className="font-semibold">{sensitivity.bestResale}</span>
            </div>
            {simulateWait && (
              <div className="flex items-center justify-between">
                <span>Wait scenario</span>
                <span className="font-semibold">{sensitivity.waitSale}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="eyebrow mb-2">Financial</div>
            <div className="space-y-3">
              <ScoreBar label="Affordability" value={affordability} />
              <ScoreBar label="Usage (freq + longevity)" value={usage} />
              <ScoreBar label="Price drag" value={priceDrag} />
              <ScoreBar label="Resale strength" value={resaleStrength} />
            </div>
          </div>
          <div>
            <div className="eyebrow mb-2">Utility & Joy</div>
            <div className="space-y-3">
              <ScoreBar label="Need" value={need} />
              <ScoreBar label="Frequency" value={freq} />
              <ScoreBar label="Joy" value={joy} />
              <ScoreBar label="Work boost" value={work} />
            </div>
          </div>
          <div>
            <div className="eyebrow mb-2">Risk & Logistics</div>
            <div className="space-y-3">
              <ScoreBar label="Return policy" value={returns} />
              <ScoreBar label="Warranty/Support" value={warr} />
              <ScoreBar label="Space fit" value={space} />
              <ScoreBar label="Fewer alternatives" value={alternatives} />
              <ScoreBar label="Urgency" value={urg} />
            </div>
            {keepOldItem && (
              <div className="mt-2">
                <Chip>minimalism penalty −{minimalismStrength}</Chip>
              </div>
            )}
            {resaleAggressive && (
              <div className="mt-2">
                <Chip>aggressive resale influence</Chip>
              </div>
            )}
          </div>
        </div>
      </section>
    </aside>
  );
}

// ---------- Main Component ----------
function BuyOrNot() {
  // Core inputs
  const [itemName, setItemName] = useState("Example: Sony WH-1000XM5");
  const [price, setPrice] = useState(500);
  const [taxRatePct, setTaxRatePct] = useState(13);
  const [budgetImpact, setBudgetImpact] = useState(5);
  const [needLevel, setNeedLevel] = useState(4);
  const [useFrequency, setUseFrequency] = useState(7);
  const [joyScore, setJoyScore] = useState(6);
  const [longevity, setLongevity] = useState(6);
  const [workRelated, setWorkRelated] = useState(false);

  // Sell-to-offset
  const [expectSalePrice, setExpectSalePrice] = useState(250);
  const [saleProbabilityPct, setSaleProbabilityPct] = useState(80);
  const [platformFees, setPlatformFees] = useState(25);
  const [shipCost, setShipCost] = useState(20);
  const [timeHours, setTimeHours] = useState(2);
  const [hourlyValue, setHourlyValue] = useState(40);
  const [friction, setFriction] = useState(10);
  const [resaleAggressive, setResaleAggressive] = useState(false);

  // Condition & demand
  const [condKey, setCondKey] =
    useState<(typeof CONDITION_PRESETS)[number]["key"]>("like_new");
  const [demandKey, setDemandKey] =
    useState<(typeof DEMAND_PRESETS)[number]["key"]>("medium");
  const cond = useMemo(
    () =>
      CONDITION_PRESETS.find((c) => c.key === condKey) ?? CONDITION_PRESETS[1],
    [condKey]
  );
  const demand = useMemo(
    () => DEMAND_PRESETS.find((d) => d.key === demandKey) ?? DEMAND_PRESETS[1],
    [demandKey]
  );

  // Wait-for-sale
  const [simulateWait, setSimulateWait] = useState(false);
  const [targetDiscountPct, setTargetDiscountPct] = useState(10);
  const [monthsToWait, setMonthsToWait] = useState(1);

  // Per-use
  const [monthsOwn, setMonthsOwn] = useState(24);
  const [usesPerWeek, setUsesPerWeek] = useState(5);

  // Minimalism nudge
  const [keepOldItem, setKeepOldItem] = useState(false);
  const [minimalismStrength, setMinimalismStrength] = useState(6);

  // Risk/logistics
  const [returnPolicy, setReturnPolicy] = useState(7);
  const [warranty, setWarranty] = useState(6);
  const [spaceFit, setSpaceFit] = useState(8);
  const [altAvailable, setAltAvailable] = useState(5);
  const [urgency, setUrgency] = useState(4);

  // Weights
  const [wFinancial, setWFinancial] = useState(0.45);
  const [wUtility, setWUtility] = useState(0.4);
  const [wRisk, setWRisk] = useState(0.15);
  const sumW = useMemo(
    () => wFinancial + wUtility + wRisk,
    [wFinancial, wUtility, wRisk]
  );

  // Persistence (localStorage)
  type Entry = {
    id: string;
    createdAt: number;
    name: string;
    inputs: Record<string, any>;
    outputs: {
      decisionScore: number;
      verdict: string;
      effectiveCost: number;
      resaleOffset: number;
      costPerUse: number;
    };
  };
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bon_entries_v1");
      if (raw) setEntries(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("bon_entries_v1", JSON.stringify(entries));
    } catch {}
  }, [entries]);

  // Brand + dynamic title
  const brand = {
    title: "Buy-or-Not",
    subtitle: "A tiny tool for clearer purchase decisions",
  };
  useEffect(() => {
    const base = brand.title;
    if (!itemName) {
      document.title = base;
      return;
    }
    document.title = `${itemName} — ${base}`;
    return () => {
      document.title = base;
    };
  }, [itemName]);

  // Derived costs
  const taxFor = (p: number) => (p * taxRatePct) / 100;
  const stickerCost = useMemo(() => price + taxFor(price), [price, taxRatePct]);
  const stickerCostWait = useMemo(() => {
    const discounted = price * (1 - targetDiscountPct / 100);
    return discounted + taxFor(discounted);
  }, [price, targetDiscountPct, taxRatePct]);

  // Adjusted by condition/demand
  const adjSaleProb = useMemo(
    () => clamp(saleProbabilityPct * cond.probMult * demand.probMult, 0, 100),
    [saleProbabilityPct, cond, demand]
  );
  const adjTimeHours = useMemo(
    () => Math.max(0, timeHours + (demand.timeHoursAdd ?? 0)),
    [timeHours, demand]
  );
  const adjSalePrice = useMemo(
    () => expectSalePrice * cond.priceMult,
    [expectSalePrice, cond]
  );

  // Resale offset & effective
  const resaleOffset = useMemo(() => {
    const prob = adjSaleProb / 100;
    const gross = adjSalePrice * prob;
    const timeCost = adjTimeHours * hourlyValue;
    const offset = gross - platformFees - shipCost - timeCost - friction;
    return Math.max(0, offset);
  }, [
    adjSaleProb,
    adjSalePrice,
    platformFees,
    shipCost,
    adjTimeHours,
    hourlyValue,
    friction,
  ]);

  const effectiveCost = useMemo(
    () => Math.max(0, stickerCost - resaleOffset),
    [stickerCost, resaleOffset]
  );

  // Per-use
  const totalExpectedUses = useMemo(
    () => Math.max(1, usesPerWeek * 4.33 * monthsOwn),
    [usesPerWeek, monthsOwn]
  );
  const costPerUse = useMemo(
    () => effectiveCost / totalExpectedUses,
    [effectiveCost, totalExpectedUses]
  );

  // Scores
  const financialScore = useMemo(() => {
    const affordability = clamp(100 - budgetImpact * 10);
    const usage = clamp(useFrequency * 8 + longevity * 4);
    const priceDrag = clamp(100 - (effectiveCost / Math.max(1, price)) * 50);
    const resaleBonus = resaleAggressive
      ? clamp((resaleOffset / Math.max(1, stickerCost)) * 100) * 0.2
      : 0;
    const cpuBonus = costPerUse < 1 ? 8 : costPerUse < 3 ? 5 : 0;
    const base =
      0.43 * affordability +
      0.32 * usage +
      0.2 * priceDrag +
      resaleBonus +
      cpuBonus;
    return clamp(base);
  }, [
    budgetImpact,
    useFrequency,
    longevity,
    effectiveCost,
    price,
    resaleAggressive,
    resaleOffset,
    stickerCost,
    costPerUse,
  ]);

  const utilityScore = useMemo(() => {
    const need = needLevel * 10;
    const joy = joyScore * 10;
    const freq = useFrequency * 8;
    const work = workRelated ? 10 : 0;
    const aggressiveNudge = resaleAggressive
      ? Math.min(10, (resaleOffset / Math.max(1, stickerCost)) * 50)
      : 0;
    return clamp(
      0.4 * need + 0.35 * freq + 0.25 * joy + work + aggressiveNudge
    );
  }, [
    needLevel,
    joyScore,
    useFrequency,
    workRelated,
    resaleAggressive,
    resaleOffset,
    stickerCost,
  ]);

  const riskScore = useMemo(() => {
    const returns = returnPolicy * 10;
    const warr = warranty * 8;
    const space = spaceFit * 8;
    const alt = 100 - altAvailable * 7;
    const urg = urgency * 6;
    const clutterPenalty = keepOldItem ? minimalismStrength : 0;
    const base =
      0.3 * returns +
      0.25 * warr +
      0.25 * space +
      0.1 * alt +
      0.1 * urg -
      clutterPenalty;
    return clamp(base);
  }, [
    returnPolicy,
    warranty,
    spaceFit,
    altAvailable,
    urgency,
    keepOldItem,
    minimalismStrength,
  ]);

  const decisionScore = useMemo(() => {
    const weighted =
      wFinancial * financialScore + wUtility * utilityScore + wRisk * riskScore;
    return Math.round(clamp(weighted));
  }, [wFinancial, wUtility, wRisk, financialScore, utilityScore, riskScore]);

  const verdict = useMemo(() => {
    if (decisionScore >= 80) return { label: "Buy", tone: "green" as const };
    if (decisionScore >= 65)
      return { label: "Lean Buy (watch price)", tone: "blue" as const };
    if (decisionScore >= 50)
      return { label: "Wait / Re-evaluate", tone: "yellow" as const };
    return { label: "Skip for now", tone: "red" as const };
  }, [decisionScore]);

  // Sensitivity
  const bestOffset = Math.max(
    0,
    adjSalePrice -
      platformFees -
      shipCost -
      adjTimeHours * hourlyValue -
      friction
  );
  const scoreFor = ({
    sticker,
    offset,
  }: {
    sticker: number;
    offset: number;
  }) => {
    const eff = Math.max(0, sticker - offset);
    const affordability = clamp(100 - budgetImpact * 10);
    const usage = clamp(useFrequency * 8 + longevity * 4);
    const priceDrag = clamp(100 - (eff / Math.max(1, price)) * 50);
    const resaleBonus = resaleAggressive
      ? clamp((offset / Math.max(1, sticker)) * 100) * 0.2
      : 0;
    const fin = clamp(
      0.43 * affordability + 0.32 * usage + 0.2 * priceDrag + resaleBonus
    );
    const utilAgg = resaleAggressive
      ? Math.min(10, (offset / Math.max(1, sticker)) * 50)
      : 0;
    const util = clamp(
      0.4 * needLevel * 10 +
        0.35 * useFrequency * 8 +
        0.25 * joyScore * 10 +
        (workRelated ? 10 : 0) +
        utilAgg
    );
    const risk = riskScore;
    const weighted = wFinancial * fin + wUtility * util + wRisk * risk;
    return Math.round(clamp(weighted));
  };
  const sensitivity = useMemo(
    () => ({
      current: decisionScore,
      noResale: scoreFor({ sticker: stickerCost, offset: 0 }),
      bestResale: scoreFor({ sticker: stickerCost, offset: bestOffset }),
      waitSale: simulateWait
        ? scoreFor({ sticker: stickerCostWait, offset: resaleOffset })
        : null,
    }),
    [
      decisionScore,
      stickerCost,
      stickerCostWait,
      resaleOffset,
      bestOffset,
      simulateWait,
    ]
  );

  const perUseBadge = useMemo(() => {
    if (costPerUse < 1)
      return { tone: "green" as const, text: "stellar per-use" };
    if (costPerUse < 3) return { tone: "blue" as const, text: "good per-use" };
    if (costPerUse < 7) return { tone: "yellow" as const, text: "ok per-use" };
    return { tone: "red" as const, text: "weak per-use" };
  }, [costPerUse]);

  // Actions
  const resetForm = () => {
    setItemName("");
    setPrice(0);
    setTaxRatePct(13);
    setBudgetImpact(5);
    setNeedLevel(5);
    setUseFrequency(5);
    setJoyScore(5);
    setLongevity(5);
    setWorkRelated(false);
    setExpectSalePrice(0);
    setSaleProbabilityPct(50);
    setPlatformFees(0);
    setShipCost(0);
    setTimeHours(1);
    setHourlyValue(30);
    setFriction(0);
    setResaleAggressive(false);
    setCondKey("like_new");
    setDemandKey("medium");
    setSimulateWait(false);
    setTargetDiscountPct(10);
    setMonthsToWait(1);
    setMonthsOwn(12);
    setUsesPerWeek(3);
    setKeepOldItem(false);
    setMinimalismStrength(6);
    setReturnPolicy(7);
    setWarranty(6);
    setSpaceFit(7);
    setAltAvailable(5);
    setUrgency(4);
    setWFinancial(0.45);
    setWUtility(0.4);
    setWRisk(0.15);
    setActiveId(null);
  };

  const saveEntry = () => {
    const id = activeId ?? `${Date.now()}`;
    const row: Entry = {
      id,
      createdAt: Date.now(),
      name: itemName || "Untitled",
      inputs: {
        itemName,
        price,
        taxRatePct,
        budgetImpact,
        needLevel,
        useFrequency,
        joyScore,
        longevity,
        workRelated,
        expectSalePrice,
        saleProbabilityPct,
        platformFees,
        shipCost,
        timeHours,
        hourlyValue,
        friction,
        resaleAggressive,
        condKey,
        demandKey,
        simulateWait,
        targetDiscountPct,
        monthsToWait,
        monthsOwn,
        usesPerWeek,
        keepOldItem,
        minimalismStrength,
        returnPolicy,
        warranty,
        spaceFit,
        altAvailable,
        urgency,
        wFinancial,
        wUtility,
        wRisk,
      },
      outputs: {
        decisionScore,
        verdict: verdict.label,
        effectiveCost,
        resaleOffset,
        costPerUse,
      },
    };
    setEntries((prev) => {
      const exists = prev.find((e) => e.id === id);
      if (exists) return prev.map((e) => (e.id === id ? row : e));
      return [row, ...prev];
    });
    if (!activeId) setActiveId(id);
  };

  const loadEntry = (e: Entry) => {
    setActiveId(e.id);
    const s = e.inputs as any;
    setItemName(s.itemName);
    setPrice(s.price);
    setTaxRatePct(s.taxRatePct);
    setBudgetImpact(s.budgetImpact);
    setNeedLevel(s.needLevel);
    setUseFrequency(s.useFrequency);
    setJoyScore(s.joyScore);
    setLongevity(s.longevity);
    setWorkRelated(s.workRelated);
    setExpectSalePrice(s.expectSalePrice);
    setSaleProbabilityPct(s.saleProbabilityPct);
    setPlatformFees(s.platformFees);
    setShipCost(s.shipCost);
    setTimeHours(s.timeHours);
    setHourlyValue(s.hourlyValue);
    setFriction(s.friction);
    setResaleAggressive(s.resaleAggressive);
    setCondKey(s.condKey);
    setDemandKey(s.demandKey);
    setSimulateWait(s.simulateWait);
    setTargetDiscountPct(s.targetDiscountPct);
    setMonthsToWait(s.monthsToWait);
    setMonthsOwn(s.monthsOwn);
    setUsesPerWeek(s.usesPerWeek);
    setKeepOldItem(s.keepOldItem);
    setMinimalismStrength(s.minimalismStrength);
    setReturnPolicy(s.returnPolicy);
    setWarranty(s.warranty);
    setSpaceFit(s.spaceFit);
    setAltAvailable(s.altAvailable);
    setUrgency(s.urgency);
    setWFinancial(s.wFinancial);
    setWUtility(s.wUtility);
    setWRisk(s.wRisk);
  };

  const deleteEntry = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const copySummary = async () => {
    const lines = [
      `Decision: ${verdict.label} (${decisionScore}/100)`,
      `Item: ${itemName || "Untitled"}`,
      `Sticker: ${currency(stickerCost)} | Effective after resale: ${currency(
        effectiveCost
      )} (offset ${currency(resaleOffset)})`,
      `Per-use: ${currency(costPerUse)} (over ~${Math.round(
        totalExpectedUses
      )} uses)`,
      `Scores — Financial ${Math.round(financialScore)}, Utility ${Math.round(
        utilityScore
      )}, Risk ${Math.round(riskScore)}`,
      simulateWait
        ? `Alt (wait ${monthsToWait} mo @ −${targetDiscountPct}%): ${sensitivity.waitSale}`
        : undefined,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      alert("Summary copied to clipboard ✨");
    } catch (err) {
      console.warn(err);
      alert("Could not copy automatically — open console for text.");
      console.log(lines);
    }
  };

  // ---------- Render ----------
  return (
    <div className="max-w-content mx-auto p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-transparent">
            {brand.title}
          </h1>
          <p className="text-sm text-slate-500">{brand.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={perUseBadge.tone}>{perUseBadge.text}</Pill>
          <Pill tone={verdict.tone}>
            {verdict.label} • {decisionScore}/100
          </Pill>
        </div>
      </header>

      {/* Two-column layout: left = content, right = sticky summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: controls & details */}
        <div className="lg:col-span-8 space-y-6">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={saveEntry}>
              Save entry
            </button>
            <button className="btn-ghost" onClick={resetForm}>
              New entry
            </button>
            <button className="btn-ghost" onClick={copySummary}>
              Copy summary
            </button>
          </div>

          <Section title="Item" subtitle="Fill in your basics">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Item name
                </span>
                <input
                  className="mt-1 w-full rounded-xl border-slate-200 focus:border-slate-400 focus:ring-0"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g., Sony WH-1000XM5"
                />
              </label>
              <LabeledNumber
                label="Price (pre-tax)"
                value={price}
                onChange={setPrice}
                min={0}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <LabeledNumber
                label="Sales tax %"
                value={taxRatePct}
                onChange={setTaxRatePct}
                min={0}
                max={30}
                step={0.5}
              />
              <div className="flex items-end">
                <div className="text-sm text-slate-600">
                  Sticker (now):{" "}
                  <span className="font-medium">{currency(stickerCost)}</span>
                </div>
              </div>
              <Toggle
                label="Simulate waiting for a sale"
                checked={simulateWait}
                onChange={setSimulateWait}
              />
              {simulateWait && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:col-span-4">
                  <Slider
                    label="Target price drop"
                    value={targetDiscountPct}
                    onChange={setTargetDiscountPct}
                    min={0}
                    max={40}
                    step={5}
                    suffixFn={(v) => `−${v}%`}
                  />
                  <LabeledNumber
                    label="Months to wait"
                    value={monthsToWait}
                    onChange={setMonthsToWait}
                    min={0}
                    max={24}
                    step={1}
                  />
                  <div className="flex items-end text-sm text-slate-600">
                    Sticker if on sale:{" "}
                    <span className="font-medium ml-1">
                      {currency(stickerCostWait)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Section
              title="Sell-to-Offset"
              subtitle="Estimate what you’ll recoup by selling the old thing"
            >
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LabeledNumber
                    label="Expected sale price (before presets)"
                    value={expectSalePrice}
                    onChange={setExpectSalePrice}
                    min={0}
                  />
                  <LabeledNumber
                    label="Base probability of sale"
                    value={saleProbabilityPct}
                    onChange={setSaleProbabilityPct}
                    min={0}
                    max={100}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Select
                    label="Condition"
                    value={condKey}
                    onChange={setCondKey}
                    options={
                      CONDITION_PRESETS as unknown as {
                        key: typeof condKey;
                        label: string;
                      }[]
                    }
                    hint="Adjusts expected price & probability"
                  />
                  <Select
                    label="Demand"
                    value={demandKey}
                    onChange={setDemandKey}
                    options={
                      DEMAND_PRESETS as unknown as {
                        key: typeof demandKey;
                        label: string;
                      }[]
                    }
                    hint="Adjusts probability & time"
                  />
                  <div className="bg-slate-50 rounded-xl p-3 text-sm flex flex-col justify-center">
                    <div>
                      Adj probability:{" "}
                      <span className="font-semibold">{pct(adjSaleProb)}</span>
                    </div>
                    <div>
                      Adj sale price:{" "}
                      <span className="font-semibold">
                        {currency(adjSalePrice)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LabeledNumber
                    label="Platform/marketplace fees"
                    value={platformFees}
                    onChange={setPlatformFees}
                    min={0}
                  />
                  <LabeledNumber
                    label="Shipping & packaging"
                    value={shipCost}
                    onChange={setShipCost}
                    min={0}
                  />
                  <LabeledNumber
                    label="Your time (hours)"
                    value={timeHours}
                    onChange={setTimeHours}
                    min={0}
                    step={0.5}
                  />
                  <LabeledNumber
                    label="Your time value ($/hr)"
                    value={hourlyValue}
                    onChange={setHourlyValue}
                    min={0}
                  />
                </div>
                <LabeledNumber
                  label="Friction/misc cost"
                  value={friction}
                  onChange={setFriction}
                  min={0}
                  hint="Gas, cleaning, odds & ends"
                />
                <Toggle
                  label="Aggressive resale influence"
                  checked={resaleAggressive}
                  onChange={setResaleAggressive}
                  hint="If on, strong resale also nudges Utility/Joy."
                />
                <div className="bg-slate-50 rounded-xl p-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    Resale offset:{" "}
                    <span className="font-semibold">
                      {currency(resaleOffset)}
                    </span>
                  </div>
                  <div>
                    Effective cost after offset:{" "}
                    <span className="font-semibold">
                      {currency(effectiveCost)}
                    </span>
                  </div>
                </div>
              </div>
            </Section>

            <Section
              title="Utility & Joy"
              subtitle="How much value do you get?"
            >
              <div className="space-y-3">
                <Slider
                  label="Need level"
                  value={needLevel}
                  onChange={setNeedLevel}
                />
                <Slider
                  label="Use frequency"
                  value={useFrequency}
                  onChange={setUseFrequency}
                />
                <Slider
                  label="Joy/delight"
                  value={joyScore}
                  onChange={setJoyScore}
                />
                <Slider
                  label="Longevity (subjective)"
                  value={longevity}
                  onChange={setLongevity}
                />
                <Toggle
                  label="Work related (productivity/earning)"
                  checked={workRelated}
                  onChange={setWorkRelated}
                />
                <div className="bg-slate-50 rounded-xl p-3 text-sm">
                  Utility/Joy sub-score:{" "}
                  <span className="font-semibold">
                    {Math.round(utilityScore)}
                  </span>
                </div>
              </div>
            </Section>

            <Section
              title="Risk, Logistics & Minimalism"
              subtitle="How safe/easy is this purchase?"
            >
              <div className="space-y-3">
                <Slider
                  label="Return policy"
                  value={returnPolicy}
                  onChange={setReturnPolicy}
                />
                <Slider
                  label="Warranty/support"
                  value={warranty}
                  onChange={setWarranty}
                />
                <Slider
                  label="Space fit"
                  value={spaceFit}
                  onChange={setSpaceFit}
                />
                <Slider
                  label="Good alternatives exist"
                  value={altAvailable}
                  onChange={setAltAvailable}
                />
                <Slider
                  label="Urgency/time sensitivity"
                  value={urgency}
                  onChange={setUrgency}
                />
                <Toggle
                  label="Keeping the old item (adds clutter)"
                  checked={keepOldItem}
                  onChange={setKeepOldItem}
                />
                {keepOldItem && (
                  <Slider
                    label="Minimalism nudge strength (penalty)"
                    value={minimalismStrength}
                    onChange={setMinimalismStrength}
                    min={0}
                    max={12}
                    step={1}
                    suffixFn={(v) => `−${v} pts`}
                  />
                )}
                <div className="bg-slate-50 rounded-xl p-3 text-sm">
                  Risk/Logistics sub-score:{" "}
                  <span className="font-semibold">{Math.round(riskScore)}</span>
                </div>
              </div>
            </Section>
          </div>

          <Section title="Budget Impact & Per-Use">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Slider
                label="Budget pain (higher = hurts)"
                value={budgetImpact}
                onChange={setBudgetImpact}
              />
              <div className="bg-slate-50 rounded-xl p-3 text-sm flex items-center justify-between">
                <div>
                  <div>
                    Financial sub-score:{" "}
                    <span className="font-semibold">
                      {Math.round(financialScore)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Uses effective cost, usage & budget pain.
                  </div>
                </div>
                <div className="text-right">
                  <div>
                    Tax:{" "}
                    <span className="font-medium">
                      {currency(taxFor(price))}
                    </span>
                  </div>
                  <div>
                    Effective cost:{" "}
                    <span className="font-medium">
                      {currency(effectiveCost)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <LabeledNumber
                    label="Months you’ll own it"
                    value={monthsOwn}
                    onChange={setMonthsOwn}
                    min={1}
                    max={120}
                  />
                  <LabeledNumber
                    label="Uses per week"
                    value={usesPerWeek}
                    onChange={setUsesPerWeek}
                    min={1}
                    max={21}
                  />
                </div>
                <div className="mt-2">
                  Cost per use (after resale):{" "}
                  <span className="font-semibold">{currency(costPerUse)}</span>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Weights & Sensitivity"
            subtitle="Tune how much each pillar matters"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <LabeledNumber
                label="Weight: Financial"
                value={wFinancial}
                onChange={setWFinancial}
                min={0}
                max={1}
                step={0.05}
              />
              <LabeledNumber
                label="Weight: Utility/Joy"
                value={wUtility}
                onChange={setWUtility}
                min={0}
                max={1}
                step={0.05}
              />
              <LabeledNumber
                label="Weight: Risk/Logistics"
                value={wRisk}
                onChange={setWRisk}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            <p
              className={`text-xs mt-2 ${
                Math.abs(sumW - 1) < 0.01 ? "text-slate-500" : "text-red-600"
              }`}
            >
              Weights should sum to ~1. Current: {sumW.toFixed(2)}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                Score now:{" "}
                <span className="font-semibold">{sensitivity.current}</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                If no resale:{" "}
                <span className="font-semibold">{sensitivity.noResale}</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                If best-case resale:{" "}
                <span className="font-semibold">{sensitivity.bestResale}</span>
              </div>
              {simulateWait && (
                <div className="bg-slate-50 rounded-xl p-3 text-sm">
                  If you wait {monthsToWait} mo @ −{targetDiscountPct}%:{" "}
                  <span className="font-semibold">{sensitivity.waitSale}</span>
                </div>
              )}
            </div>
          </Section>

          <Section
            title="History"
            subtitle="Your saved purchase ideas (stored in this browser)"
          >
            {entries.length === 0 ? (
              <p className="text-sm text-slate-500">
                No entries yet. Tune something above and hit{" "}
                <span className="font-medium">Save entry</span>.
              </p>
            ) : (
              <div className="space-y-2">
                {entries.map((e) => (
                  <div
                    key={e.id}
                    className={`flex flex-col md:flex-row md:items-center justify-between gap-2 border rounded-xl p-3 ${
                      activeId === e.id
                        ? "border-slate-900"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">{e.name}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(e.createdAt).toLocaleString()} •{" "}
                        {e.outputs.verdict} • {e.outputs.decisionScore}/100 •
                        Eff: {currency(e.outputs.effectiveCost)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn-ghost"
                        onClick={() => loadEntry(e)}
                      >
                        Load
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          setItemName(e.inputs.itemName);
                          setActiveId(e.id);
                        }}
                      >
                        Rename via Item
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => deleteEntry(e.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Explain the Math"
            subtitle="Transparent formula sketch"
          >
            <div className="text-sm space-y-2">
              <p>
                <span className="font-medium">Effective Cost</span> = (Price +
                Tax) − max(0, AdjSalePrice×AdjProb − Fees − Shipping −
                (AdjTimeHours×$∕hr) − Friction)
              </p>
            </div>
          </Section>

          <footer className="pt-2 text-xs text-slate-500 flex items-center justify-between">
            <div>
              Made by <span className="font-medium">you</span>. Weights &
              formulas are editable — trust your judgment.
            </div>
            <a className="underline" href="#top">
              Back to top
            </a>
          </footer>
        </div>

        {/* RIGHT: sticky summary */}
        <div className="lg:col-span-4">
          <DecisionSummary
            verdictLabel={verdict.label}
            decisionScore={decisionScore}
            stickerCost={stickerCost}
            effectiveCost={effectiveCost}
            resaleOffset={resaleOffset}
            costPerUse={costPerUse}
            sensitivity={sensitivity}
            simulateWait={simulateWait}
            monthsToWait={monthsToWait}
            targetDiscountPct={targetDiscountPct}
            budgetImpact={budgetImpact}
            useFrequency={useFrequency}
            longevity={longevity}
            price={price}
            taxFor={taxFor}
            needLevel={needLevel}
            joyScore={joyScore}
            workRelated={workRelated}
            resaleAggressive={resaleAggressive}
            altAvailable={altAvailable}
            returnPolicy={returnPolicy}
            warranty={warranty}
            spaceFit={spaceFit}
            urgency={urgency}
            keepOldItem={keepOldItem}
            minimalismStrength={minimalismStrength}
          />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <BuyOrNot />;
}
