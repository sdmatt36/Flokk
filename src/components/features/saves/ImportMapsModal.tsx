"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type ImportResult = { imported: number; skipped: number; geocodeFailed?: number };

type Props = {
  onClose: () => void;
  onImported?: () => void;
};

export function ImportMapsModal({ onClose, onImported }: Props) {
  const router = useRouter();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importState, setImportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    if (!importFile || importState === "loading") return;
    setImportState("loading");
    setImportError(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch("/api/saves/import-maps", { method: "POST", body: fd });
      const data = await res.json() as { imported?: number; skipped?: number; geocodeFailed?: number; error?: string };
      if (!res.ok || data.error) { setImportState("error"); setImportError(data.error ?? "Import failed."); return; }
      setImportResult({ imported: data.imported ?? 0, skipped: data.skipped ?? 0, geocodeFailed: data.geocodeFailed });
      setImportState("done");
      onImported?.();
    } catch { setImportState("error"); setImportError("Network error. Please try again."); }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "28px 24px 40px", boxSizing: "border-box" }}
        onClick={e => e.stopPropagation()}
      >
        {importState === "done" && importResult ? (
          <>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#1B3A5C", marginBottom: 8 }}>Import complete</p>
            <p style={{ fontSize: 14, color: "#444", marginBottom: 4 }}>
              <strong>{importResult.imported}</strong> place{importResult.imported !== 1 ? "s" : ""} added to your saves.
            </p>
            {importResult.skipped > 0 && (
              <p style={{ fontSize: 13, color: "#717171", marginBottom: 4 }}>
                {importResult.skipped} already existed and were skipped.
              </p>
            )}
            {(importResult.geocodeFailed ?? 0) > 0 && (
              <p style={{ fontSize: 13, color: "#717171", marginBottom: 16 }}>
                {importResult.geocodeFailed} could not be located and were skipped.
              </p>
            )}
            <button
              onClick={() => { onClose(); router.push("/saves?tab=imported"); }}
              style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "#C4664A", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}
            >
              View your imports
            </button>
            <button
              onClick={onClose}
              style={{ display: "block", width: "100%", background: "none", border: "none", fontSize: 13, color: "#717171", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#1B3A5C", marginBottom: 6 }}>Import from Google Maps</p>
            <p style={{ fontSize: 13, color: "#717171", lineHeight: 1.6, marginBottom: 8 }}>
              Export your data at{" "}
              <a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "#1B3A5C", fontWeight: 600 }}>takeout.google.com</a>
              , unzip the archive, then upload any of these:
            </p>
            <ul style={{ fontSize: 13, color: "#717171", lineHeight: 1.7, marginBottom: 8, paddingLeft: 18 }}>
              <li><strong>.csv</strong> from <code style={{ fontSize: 12 }}>/Takeout/Saved/</code> (your saved lists like &ldquo;Want to go&rdquo; or custom lists)</li>
              <li><strong>Saved Places.json</strong> from <code style={{ fontSize: 12 }}>/Takeout/Maps (your places)/</code> (starred places)</li>
              <li><strong>.kml</strong> from Google My Maps (custom maps)</li>
            </ul>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>We look up coordinates automatically for places that don&apos;t include them.</p>

            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.json,.kml,.kmz"
              style={{ display: "none" }}
              onChange={e => setImportFile(e.target.files?.[0] ?? null)}
            />

            <button
              onClick={() => importInputRef.current?.click()}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10, marginBottom: 12,
                border: "1.5px dashed #1B3A5C", background: "#F8FAFF",
                color: "#1B3A5C", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {importFile ? importFile.name : "Choose file (.csv, .json, or .kml)"}
            </button>

            {importError && (
              <p style={{ fontSize: 13, color: "#c0392b", marginBottom: 10 }}>{importError}</p>
            )}

            <button
              onClick={handleImport}
              disabled={!importFile || importState === "loading"}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                background: importFile ? "#C4664A" : "#E8E8E8",
                color: importFile ? "#fff" : "#aaa",
                fontSize: 14, fontWeight: 600,
                cursor: importFile ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              {importState === "loading" ? "Importing…" : "Import Places"}
            </button>

            <button
              onClick={onClose}
              style={{ display: "block", width: "100%", marginTop: 12, background: "none", border: "none", fontSize: 13, color: "#717171", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
