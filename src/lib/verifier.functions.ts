import { createServerFn } from "@tanstack/react-start";

export const VERIFIER_SYSTEM_PROMPT = `You are the VERIFIER stage of a forex trading pipeline.

You receive: (1) the Picker's chosen setup(s), (2) the Structure Scout SUMMARY block and setup lines, (3) raw candles / OHLC data, and (4) any chart notes provided.

Your job is to challenge the Picker, not to agree with it. Never invent prices; every claim must trace back to a row in the supplied data. If data needed for a check is missing, say exactly which field is missing.

Return your verdict in EXACTLY this structure, as plain text:

=== VERDICT SUMMARY ===
1. Staleness Check — how old is the data vs the setup trigger, and is the setup still current?
2. Join/Spot Validity — is this a valid join (already-moving) or spot (fresh) entry, or has price already left the zone?
3. RR Reality — recompute RR from entry/SL/TP with spread applied; state whether the stated RR holds.
4. Fill Feasibility — can the entry realistically fill from current price, and what would have to happen first?
5. Visual Confirmation — what the candle/structure evidence supports or contradicts.
6. Data Age — restate data_age and its effect on confidence.
7. Final Call — one of TAKE / SKIP / WAIT, with a one-line reason.
8. Adjusted Trade — only if the setup is salvageable: adjusted entry, SL, TP and RR. Otherwise write "none".`;

const OPENROUTER_MODELS = [
  "deepseek/deepseek-r1:free",
  "deepseek/deepseek-r1-0528:free",
  "deepseek/deepseek-chat-v3-0324:free",
];

const NVIDIA_MODELS = ["deepseek-ai/deepseek-r1-0528", "deepseek-ai/deepseek-r1"];

export interface VerifyResult {
  verdict: string;
  provider: "openrouter" | "nvidia";
  model: string;
  warnings: string[];
}

interface ChatResponse {
  choices?: { message?: { content?: string; reasoning?: string } }[];
  error?: { message?: string };
}

async function callChat(
  url: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 2000 }),
  });

  const text = await res.text();
  let payload: ChatResponse = {};
  try {
    payload = JSON.parse(text) as ChatResponse;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    throw new Error(payload.error?.message ?? `${res.status} ${text.slice(0, 300)}`);
  }
  const choice = payload.choices?.[0]?.message;
  const content = (choice?.content ?? "").trim() || (choice?.reasoning ?? "").trim();
  if (!content) throw new Error("empty response from model");
  return content;
}

export const verifySetup = createServerFn({ method: "POST" })
  .inputValidator((input: { pickerOutput: string; scoutData: string; chartNotes?: string }) => {
    if (!input || typeof input.pickerOutput !== "string" || input.pickerOutput.trim() === "") {
      throw new Error("Picker output is required");
    }
    return input;
  })
  .handler(async ({ data }): Promise<VerifyResult> => {
    const userContent = [
      "--- PICKER OUTPUT ---",
      data.pickerOutput.trim(),
      "",
      "--- STRUCTURE SCOUT DATA (SUMMARY + setups + candles/OHLC) ---",
      data.scoutData.trim() || "(none supplied)",
      "",
      "--- CHART NOTES ---",
      (data.chartNotes ?? "").trim() || "(none supplied)",
    ].join("\n");

    const messages = [
      { role: "system", content: VERIFIER_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];

    const warnings: string[] = [];
    const openRouterKey = process.env["OPENROUTER_API_KEY"];
    const nvidiaKey = process.env["NVIDIA_API_KEY"];

    if (openRouterKey) {
      // Free DeepSeek R1 slugs, newest first — OpenRouter retires them periodically.
      for (const model of OPENROUTER_MODELS) {
        try {
          const verdict = await callChat(
            "https://openrouter.ai/api/v1/chat/completions",
            openRouterKey,
            model,
            messages,
            {
              "HTTP-Referer": "https://structure-scout.lovable.app",
              "X-Title": "Structure Scout",
            },
          );
          return { verdict, provider: "openrouter", model, warnings };
        } catch (error) {
          warnings.push(
            `OpenRouter ${model} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } else {
      warnings.push("OPENROUTER_API_KEY is not configured");
    }

    if (!nvidiaKey) {
      throw new Error(
        `Verifier unavailable. ${warnings.join(" | ")} | NVIDIA_API_KEY is not configured`,
      );
    }

    for (const model of NVIDIA_MODELS) {
      try {
        const verdict = await callChat(
          "https://integrate.api.nvidia.com/v1/chat/completions",
          nvidiaKey,
          model,
          messages,
        );
        return { verdict, provider: "nvidia", model, warnings };
      } catch (error) {
        warnings.push(
          `NVIDIA NIM ${model} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    throw new Error(`Verifier failed. ${warnings.join(" | ")}`);
  });
