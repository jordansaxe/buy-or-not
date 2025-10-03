import { useMemo, useState } from "react";

/**
 * Buy-or-Not Calculator (React + TS + Tailwind)
 * Vibe: like should-i-buy-it, plus:
 *  - Sell-to-Offset (resale) w/ fees, shipping, time value, friction
 *  - Condition & Demand presets (affect resale price/probability/time)
 *  - Wait-for-Sale simulator (target discount & months delay)
 *  - Per-use math (months owned, uses/week)
 *  - Minimalism nudge (penalty if you keep the old item)
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
    <div className="bg-white rounded-2xl shadow p-5 space-y-3 border border-gray-100">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
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
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
      <input
        type="number"
        className="mt-1 w-full rounded-xl border-gray-200 focus:border-gray-400 focus:ring-0"
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
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-xs text-gray-500">{suffixFn(value)}</span>
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
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {hint && <div className="text-xs text-gray-500">{hint}</div>}
      </div>
      <button
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-gray-900" : "bg-gray-300"
        }`}
        onClick={() => onChange(!checked)}
        type="button"
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

function Select({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
      <select
        className="mt-1 w-full rounded-xl border-gray-200 focus:border-gray-400 focus:ring-0 bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
    gray: "bg-gray-100 text-gray-800",
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

// ---------- Main Component ----------
function BuyOrNot() {
  // Core inputs
  const [itemName, setItemName] = useState("Example: Sony WH-1000XM5");
  const [price, setPrice] = useState(500);
  const [taxRatePct, setTaxRatePct] = useState(13); // ON HST
  const [budgetImpact, setBudgetImpact] = useState(5); // 0..10
  const [needLevel, setNeedLevel] = useState(4); // 0..10
  const [useFrequency, setUseFrequency] = useState(7); // 0..10
  const [joyScore, setJoyScore] = useState(6); // 0..10
  const [longevity, setLongevity] = useState(6); // 0..10
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

  // Condition & demand presets
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

  // Risk/logistics sliders
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

  // Derived cost
  const taxFor = (p: number) => (p * taxRatePct) / 100;
  const stickerCost = useMemo(() => price + taxFor(price), [price, taxRatePct]);
  const stickerCostWait = useMemo(() => {
    const discounted = price * (1 - targetDiscountPct / 100);
    return discounted + taxFor(discounted);
  }, [price, targetDiscountPct, taxRatePct]);

  // Adjust for condition/demand
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

  // Resale offset & effective cost
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
    const alt = 100 - altAvailable * 7; // more good alternatives => lower score
    const urg = urgency * 6; // higher urgency => higher score
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

  // Sensitivity + wait-for-sale scoring
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
    const risk = riskScore; // unchanged by price
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

  // ---------- Render ----------
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Buy-or-Not Calculator
          </h1>
          <p className="text-sm text-gray-500">
            Decide smarter with resale offsets, wait-for-sale sim, per-use math
            & minimalism nudge.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={perUseBadge.tone}>{perUseBadge.text}</Pill>
          <Pill tone={verdict.tone}>
            {verdict.label} • {decisionScore}/100
          </Pill>
        </div>
      </header>

      {/* Item & Wait-for-Sale */}
      <Section title="Item" subtitle="Fill in your basics">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="md:col-span-2">
            <span className="text-sm font-medium text-gray-700">Item name</span>
            <input
              className="mt-1 w-full rounded-xl border-gray-200 focus:border-gray-400 focus:ring-0"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </label>
          <LabeledNumber
            label="Price (pre-tax)"
            value={price}
            onChange={setPrice}
            min={0}
            step={1}
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
            <div className="text-sm text-gray-600">
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
              <div className="flex items-end text-sm text-gray-600">
                Sticker if on sale:{" "}
                <span className="font-medium ml-1">
                  {currency(stickerCostWait)}
                </span>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Three-column: Resale, Utility, Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sell-to-Offset */}
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
                onChange={(v) =>
                  setCondKey(v as (typeof CONDITION_PRESETS)[number]["key"])
                }
                options={CONDITION_PRESETS as any}
                hint="Adjusts expected price & probability"
              />
              <Select
                label="Demand"
                value={demandKey}
                onChange={(v) =>
                  setDemandKey(v as (typeof DEMAND_PRESETS)[number]["key"])
                }
                options={DEMAND_PRESETS as any}
                hint="Adjusts probability & time"
              />
              <div className="bg-gray-50 rounded-xl p-3 text-sm flex flex-col justify-center">
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

            <div className="bg-gray-50 rounded-xl p-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                Resale offset:{" "}
                <span className="font-semibold">{currency(resaleOffset)}</span>
              </div>
              <div>
                Effective cost after offset:{" "}
                <span className="font-semibold">{currency(effectiveCost)}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Utility & Joy */}
        <Section title="Utility & Joy" subtitle="How much value do you get?">
          <div className="space-y-3">
            <Slider
              label="Need level"
              value={needLevel}
              onChange={setNeedLevel}
              suffixFn={(v) => String(v)}
            />
            <Slider
              label="Use frequency"
              value={useFrequency}
              onChange={setUseFrequency}
              suffixFn={(v) => String(v)}
            />
            <Slider
              label="Joy/delight"
              value={joyScore}
              onChange={setJoyScore}
              suffixFn={(v) => String(v)}
            />
            <Slider
              label="Longevity (subjective)"
              value={longevity}
              onChange={setLongevity}
              suffixFn={(v) => String(v)}
            />
            <Toggle
              label="Work related (productivity/earning)"
              checked={workRelated}
              onChange={setWorkRelated}
            />
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              Utility/Joy sub-score:{" "}
              <span className="font-semibold">{Math.round(utilityScore)}</span>
            </div>
          </div>
        </Section>

        {/* Risk, Logistics & Minimalism */}
        <Section
          title="Risk, Logistics & Minimalism"
          subtitle="How safe/easy is this purchase?"
        >
          <div className="space-y-3">
            <Slider
              label="Return policy"
              value={returnPolicy}
              onChange={setReturnPolicy}
              suffixFn={(v) => String(v)}
            />
            <Slider
              label="Warranty/support"
              value={warranty}
              onChange={setWarranty}
              suffixFn={(v) => String(v)}
            />
            <Slider
              label="Space fit"
              value={spaceFit}
              onChange={setSpaceFit}
              suffixFn={(v) => String(v)}
            />
            <Slider
              label="Good alternatives exist"
              value={altAvailable}
              onChange={setAltAvailable}
              suffixFn={(v) => String(v)}
            />
            <Slider
              label="Urgency/time sensitivity"
              value={urgency}
              onChange={setUrgency}
              suffixFn={(v) => String(v)}
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
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              Risk/Logistics sub-score:{" "}
              <span className="font-semibold">{Math.round(riskScore)}</span>
            </div>
          </div>
        </Section>
      </div>

      {/* Budget & Per-Use */}
      <Section title="Budget Impact & Per-Use">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Slider
            label="Budget pain (higher = hurts)"
            value={budgetImpact}
            onChange={setBudgetImpact}
            suffixFn={(v) => String(v)}
          />
          <div className="bg-gray-50 rounded-xl p-3 text-sm flex items-center justify-between">
            <div>
              <div>
                Financial sub-score:{" "}
                <span className="font-semibold">
                  {Math.round(financialScore)}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Uses effective cost, usage & budget pain.
              </div>
            </div>
            <div className="text-right">
              <div>
                Tax:{" "}
                <span className="font-medium">{currency(taxFor(price))}</span>
              </div>
              <div>
                Effective cost:{" "}
                <span className="font-medium">{currency(effectiveCost)}</span>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
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

      {/* Weights & Sensitivity */}
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
            Math.abs(sumW - 1) < 0.01 ? "text-gray-500" : "text-red-600"
          }`}
        >
          Weights should sum to ~1. Current: {sumW.toFixed(2)}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            Score now:{" "}
            <span className="font-semibold">{sensitivity.current}</span>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            If no resale:{" "}
            <span className="font-semibold">{sensitivity.noResale}</span>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            If best-case resale:{" "}
            <span className="font-semibold">{sensitivity.bestResale}</span>
          </div>
          {simulateWait && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              If you wait {monthsToWait} mo @ −{targetDiscountPct}%:{" "}
              <span className="font-semibold">{sensitivity.waitSale}</span>
            </div>
          )}
        </div>
      </Section>

      {/* Explain the Math */}
      <Section title="Explain the Math" subtitle="Transparent formula sketch">
        <div className="text-sm space-y-2">
          <p>
            <span className="font-medium">Effective Cost</span> = (Price + Tax)
            − max(0, AdjSalePrice×AdjProb − Fees − Shipping −
            (AdjTimeHours×$∕hr) − Friction)
          </p>
          <p>
            <span className="font-medium">AdjSalePrice</span> &{" "}
            <span className="font-medium">AdjProb</span> come from Condition &
            Demand.
          </p>
          <p>
            <span className="font-medium">Financial</span> ≈ 43%·Affordability +
            32%·Usage + 20%·PriceDrag (+ optional ResaleBonus + Per-Use bonus)
          </p>
          <p>
            <span className="font-medium">Utility/Joy</span> ≈ 40%·Need +
            35%·Frequency + 25%·Joy (+ Work bonus) (+ optional Aggressive resale
            nudge)
          </p>
          <p>
            <span className="font-medium">Risk/Logistics</span> ≈ 30%·Returns +
            25%·Warranty + 25%·Space + 10%·(less Alternatives) + 10%·Urgency −
            Minimalism penalty (if keeping old item)
          </p>
          <p>
            <span className="font-medium">Decision Score</span> = Wf·Financial +
            Wu·Utility + Wr·Risk (0–100)
          </p>
          <p>
            <span className="font-medium">Wait-for-Sale</span> sim recomputes
            sticker price at target discount and shows the alternate score.
          </p>
        </div>
      </Section>
    </div>
  );
}

export default function App() {
  return <BuyOrNot />;
}
