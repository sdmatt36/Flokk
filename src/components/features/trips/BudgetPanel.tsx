"use client";

import { useState, useEffect, useRef } from "react";

const DEST_CURRENCY_MAP: Record<string, string> = {
  Seoul: "KRW",
  Busan: "KRW",
  Tokyo: "JPY",
  Osaka: "JPY",
  Kyoto: "JPY",
  Fukuoka: "JPY",
  Sapporo: "JPY",
  Okinawa: "JPY",
  Naha: "JPY",
  London: "GBP",
  Paris: "EUR",
  Rome: "EUR",
  Barcelona: "EUR",
  Amsterdam: "EUR",
  Berlin: "EUR",
  Madrid: "EUR",
  Lisbon: "EUR",
  Sydney: "AUD",
  Melbourne: "AUD",
  Brisbane: "AUD",
  Toronto: "CAD",
  Vancouver: "CAD",
  Bangkok: "THB",
  Bali: "IDR",
  Singapore: "SGD",
  Dubai: "AED",
  "Hong Kong": "HKD",
  Taipei: "TWD",
};

function getDestinationCurrency(destinationCity: string | null | undefined): string {
  if (!destinationCity) return "USD";
  const match = Object.keys(DEST_CURRENCY_MAP).find(
    (k) => destinationCity.toLowerCase().includes(k.toLowerCase())
  );
  return match ? DEST_CURRENCY_MAP[match] : "USD";
}

const CURRENCIES = ["USD", "GBP", "EUR", "JPY", "KRW", "AUD", "CAD", "SGD", "THB", "AED", "HKD", "TWD", "IDR"];

export function BudgetPanel({
  tripId,
  destinationCity,
  budgetTotal,
  budgetCurrency,
  budgetSpent,
  loaded,
  onBudgetChange,
}: {
  tripId: string | undefined;
  destinationCity?: string | null;
  budgetTotal: number | null;
  budgetCurrency: string;
  budgetSpent: number;
  loaded: boolean;
  onBudgetChange: (total: number | null, currency: string) => void;
}) {
  const [inputTotal, setInputTotal] = useState<string>(budgetTotal !== null ? String(budgetTotal) : "");
  const [inputCurrency, setInputCurrency] = useState(budgetCurrency);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const rateCache = useRef<Record<string, number>>({});

  const destCurrency = getDestinationCurrency(destinationCity);

  // Sync input values when props load from DB (on initial load only)
  useEffect(() => {
    setInputTotal(budgetTotal !== null ? String(budgetTotal) : "");
    setInputCurrency(budgetCurrency);
  }, [budgetTotal, budgetCurrency]);

  // Fetch exchange rate when home currency or destination changes
  useEffect(() => {
    if (destCurrency === inputCurrency) {
      setExchangeRate(null);
      return;
    }
    const cacheKey = `${inputCurrency}-${destCurrency}`;
    if (rateCache.current[cacheKey]) {
      setExchangeRate(rateCache.current[cacheKey]);
      return;
    }
    fetch(`https://open.er-api.com/v6/latest/${inputCurrency}`)
      .then((r) => r.json())
      .then((data: { rates?: Record<string, number> }) => {
        const rate = data.rates?.[destCurrency] ?? null;
        if (rate) {
          rateCache.current[cacheKey] = rate;
          setExchangeRate(rate);
        }
      })
      .catch(() => {});
  }, [inputCurrency, destCurrency]);

  async function handleSave(total: number | null, currency: string) {
    if (!tripId) return;
    setSaving(true);
    try {
      await fetch(`/api/trips/${tripId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetTotal: total, budgetCurrency: currency }),
      });
      onBudgetChange(total, currency);
    } catch (err) {
      console.error("[BudgetPanel save]", err);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  const parsedTotal = inputTotal ? Number(inputTotal) : null;
  const pct =
    parsedTotal && parsedTotal > 0
      ? Math.min(100, (budgetSpent / parsedTotal) * 100)
      : 0;
  const showConversion =
    destCurrency !== inputCurrency && exchangeRate !== null && budgetSpent > 0;
  const convertedSpent = exchangeRate !== null ? Math.round(budgetSpent * exchangeRate) : 0;
  const hasTrackedData = parsedTotal !== null || budgetSpent > 0;

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: "12px",
        padding: "16px 18px",
        marginBottom: "16px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "#1B3A5C",
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}
      >
        Trip Budget
      </p>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: hasTrackedData ? "12px" : "0" }}>
        <select
          value={inputCurrency}
          onChange={(e) => {
            const newCurrency = e.target.value;
            setInputCurrency(newCurrency);
            const t = inputTotal ? Number(inputTotal) : null;
            handleSave(t, newCurrency);
          }}
          style={{
            padding: "7px 10px",
            borderRadius: "8px",
            border: "1px solid #E0E0E0",
            fontSize: "13px",
            color: "#1B3A5C",
            backgroundColor: "#fff",
            flexShrink: 0,
          }}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="100"
          value={inputTotal}
          onChange={(e) => setInputTotal(e.target.value)}
          onBlur={(e) => {
            const t = e.target.value ? Number(e.target.value) : null;
            handleSave(t, inputCurrency);
          }}
          placeholder="Total budget"
          style={{
            flex: 1,
            padding: "7px 12px",
            borderRadius: "8px",
            border: "1px solid #E0E0E0",
            fontSize: "13px",
            color: "#1B3A5C",
            outline: "none",
            opacity: saving ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        />
      </div>

      {hasTrackedData && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: parsedTotal !== null ? "8px" : "0",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C" }}>
              {parsedTotal !== null
                ? `${inputCurrency} ${budgetSpent.toLocaleString()} of ${inputCurrency} ${parsedTotal.toLocaleString()} tracked`
                : `${inputCurrency} ${budgetSpent.toLocaleString()} tracked so far`}
            </span>
            {parsedTotal !== null && (
              <span style={{ fontSize: "12px", color: "#717171" }}>{Math.round(pct)}%</span>
            )}
          </div>

          {parsedTotal !== null && (
            <div
              style={{
                height: "6px",
                borderRadius: "999px",
                backgroundColor: "#EEEEEE",
                overflow: "hidden",
                marginBottom: showConversion ? "10px" : "0",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: "999px",
                  backgroundColor: pct >= 90 ? "#D97706" : "#C4664A",
                  width: `${pct}%`,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          )}

          {showConversion && (
            <div style={{ paddingTop: "8px", borderTop: "1px solid #F0F0F0" }}>
              <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>
                ≈ {destCurrency} {convertedSpent.toLocaleString()} tracked at destination
              </p>
              <p style={{ fontSize: "11px", color: "#AAAAAA", margin: "2px 0 0" }}>
                Exchange rate: 1 {inputCurrency} ={" "}
                {exchangeRate?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {destCurrency} (live)
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
