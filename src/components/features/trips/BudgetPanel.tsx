"use client";

import { useState, useEffect, useRef } from "react";

const DEST_CURRENCY: Record<string, string> = {
  Okinawa: "JPY", Tokyo: "JPY", Osaka: "JPY", Kyoto: "JPY",
  Fukuoka: "JPY", Sapporo: "JPY", Naha: "JPY",
  Seoul: "KRW", Busan: "KRW",
  London: "GBP",
  Paris: "EUR", Rome: "EUR", Barcelona: "EUR", Amsterdam: "EUR",
  Berlin: "EUR", Madrid: "EUR", Lisbon: "EUR",
  Sydney: "AUD", Melbourne: "AUD", Brisbane: "AUD",
  Toronto: "CAD", Vancouver: "CAD",
  Singapore: "SGD", Bangkok: "THB", Bali: "IDR",
  Dubai: "AED", "Hong Kong": "HKD", Taipei: "TWD",
};

const COUNTRY_CURRENCY: Record<string, string> = {
  Japan: "JPY", Korea: "KRW", "South Korea": "KRW",
  UK: "GBP", "United Kingdom": "GBP", Ireland: "EUR",
  France: "EUR", Germany: "EUR", Italy: "EUR", Spain: "EUR",
  Netherlands: "EUR", Portugal: "EUR", Austria: "EUR",
  Australia: "AUD", Canada: "CAD", Singapore: "SGD",
  Thailand: "THB", Indonesia: "IDR", Vietnam: "VND",
  UAE: "AED", "United Arab Emirates": "AED",
  Mexico: "MXN", India: "INR", China: "CNY",
};

function getDestCurrency(destination: string | null | undefined): string {
  if (!destination) return "USD";
  for (const [city, curr] of Object.entries(DEST_CURRENCY)) {
    if (destination.includes(city)) return curr;
  }
  for (const [country, curr] of Object.entries(COUNTRY_CURRENCY)) {
    if (destination.includes(country)) return curr;
  }
  return "USD";
}

const CURRENCIES = ["USD", "GBP", "EUR", "JPY", "KRW", "AUD", "CAD", "SGD", "THB", "AED", "HKD", "TWD", "IDR"];

export function BudgetPanel({
  tripId,
  destinationCity,
  destinationCountry,
  budgetTotal,
  budgetCurrency,
  trackedTotal,
  loaded,
  onBudgetChange,
}: {
  tripId: string | undefined;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  budgetTotal: number | null;
  budgetCurrency: string;
  trackedTotal: number;
  loaded: boolean;
  onBudgetChange: (total: number | null, currency: string) => void;
}) {
  const [inputTotal, setInputTotal] = useState<string>(budgetTotal !== null ? String(budgetTotal) : "");
  const [inputCurrency, setInputCurrency] = useState(budgetCurrency);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [showDestCurrency, setShowDestCurrency] = useState(false);
  const [saving, setSaving] = useState(false);
  const rateCache = useRef<Record<string, number>>({});

  const destLabel = destinationCity ?? destinationCountry ?? null;
  const destCurrency = getDestCurrency(destLabel);

  // Sync input values when props load from DB (on initial load only)
  useEffect(() => {
    setInputTotal(budgetTotal !== null ? String(budgetTotal) : "");
    setInputCurrency(budgetCurrency);
  }, [budgetTotal, budgetCurrency]);

  // Fetch exchange rate when home currency or destination changes
  useEffect(() => {
    if (destCurrency === inputCurrency) {
      setExchangeRate(null);
      setShowDestCurrency(false);
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
  const hasTrackedData = parsedTotal !== null || trackedTotal > 0;
  const canToggle = destCurrency !== inputCurrency && exchangeRate !== null;

  // Display values — switch between home and destination currency
  const displayCurrency = showDestCurrency && canToggle ? destCurrency : inputCurrency;
  const displayTracked = showDestCurrency && canToggle && exchangeRate
    ? Math.round(trackedTotal * exchangeRate)
    : trackedTotal;
  const displayBudget = showDestCurrency && canToggle && exchangeRate && parsedTotal
    ? Math.round(parsedTotal * exchangeRate)
    : parsedTotal;
  const pct = displayBudget && displayBudget > 0
    ? Math.min(100, (displayTracked / displayBudget) * 100)
    : 0;

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
            setShowDestCurrency(false);
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
            <option key={c} value={c}>{c}</option>
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
              marginBottom: displayBudget !== null ? "8px" : "0",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C" }}>
              {displayBudget !== null
                ? `${displayCurrency} ${displayTracked.toLocaleString()} of ${displayCurrency} ${displayBudget.toLocaleString()} tracked`
                : `${displayCurrency} ${displayTracked.toLocaleString()} tracked so far`}
              {canToggle && (
                <button
                  onClick={() => setShowDestCurrency(!showDestCurrency)}
                  style={{
                    marginLeft: "10px",
                    fontSize: "11px",
                    color: "#C4664A",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "inherit",
                    fontWeight: 600,
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  }}
                >
                  {showDestCurrency ? `Show in ${inputCurrency}` : `Show in ${destCurrency}`}
                </button>
              )}
            </span>
            {displayBudget !== null && (
              <span style={{ fontSize: "12px", color: "#717171" }}>{Math.round(pct)}%</span>
            )}
          </div>

          {displayBudget !== null && (
            <div
              style={{
                height: "6px",
                borderRadius: "999px",
                backgroundColor: "#EEEEEE",
                overflow: "hidden",
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
        </>
      )}
    </div>
  );
}
