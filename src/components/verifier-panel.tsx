import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { verifySetup, type VerifyResult } from "@/lib/verifier.functions";

interface VerifierPanelProps {
  /** Prefilled scout context: SUMMARY block, setups, candles/OHLC. */
  scoutData: string;
}

export function VerifierPanel({ scoutData }: VerifierPanelProps) {
  const runVerifier = useServerFn(verifySetup);
  const [pickerOutput, setPickerOutput] = useState("");
  const [chartNotes, setChartNotes] = useState("");
  const [scout, setScout] = useState(scoutData);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await runVerifier({
        data: { pickerOutput, scoutData: scout, chartNotes },
      });
      setResult(outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium text-foreground">Verifier</h2>
        <p className="text-xs text-muted-foreground">
          Sends the Picker&apos;s output plus this scout data to DeepSeek R1 (OpenRouter, with NVIDIA
          NIM fallback) and returns the verdict summary.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Picker output
        <textarea
          value={pickerOutput}
          onChange={(e) => setPickerOutput(e.target.value)}
          rows={5}
          placeholder="Paste the Picker's chosen setup(s) here"
          className="num rounded-md border border-border bg-secondary/40 p-3 text-xs text-foreground"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Structure Scout data (SUMMARY / setups / candles)
        <textarea
          value={scout}
          onChange={(e) => setScout(e.target.value)}
          rows={6}
          className="num rounded-md border border-border bg-secondary/40 p-3 text-xs text-foreground"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Chart notes (optional)
        <textarea
          value={chartNotes}
          onChange={(e) => setChartNotes(e.target.value)}
          rows={3}
          className="num rounded-md border border-border bg-secondary/40 p-3 text-xs text-foreground"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || pickerOutput.trim() === ""}
          onClick={() => void verify()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Verifying…" : "Run verifier"}
        </button>
        {result ? (
          <span className="num text-xs text-muted-foreground">
            via {result.provider} · {result.model}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="num rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {result?.warnings.length ? (
        <p className="num rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-foreground">
          {result.warnings.join(" | ")}
        </p>
      ) : null}

      {result ? (
        <pre className="num max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-4 text-xs text-foreground">
          {result.verdict}
        </pre>
      ) : null}
    </section>
  );
}
