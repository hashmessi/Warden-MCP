import { config } from "../config.js";
import type { ImpactReport } from "./types.js";

/**
 * Optionally enriches the report with an LLM-generated plain-English narrative.
 * Silently returns the report unchanged if LLM is disabled or the call fails.
 * Uses native fetch — no openai package required.
 */
export async function enrichWithNarrative(report: ImpactReport): Promise<ImpactReport> {
  if (!config.llm.enabled || !config.llm.openaiApiKey) {
    return report;
  }

  try {
    const depText = report.sections.dependencies.hasRisks
      ? report.sections.dependencies.items.map((i) => i.description).join("; ")
      : "None";

    const prompt = [
      "You are a data privacy compliance assistant.",
      "Summarize the following data impact report in 3 clear, concise sentences for a human reviewer making a deletion approval decision.\n",
      `Subject: ${report.subject}`,
      `Total records found: ${report.sections.dataFound.totalRecords}`,
      `Systems: ${report.sections.dataFound.systems.join(", ")}`,
      `Risk level: ${report.sections.riskLevel}`,
      `Dependencies: ${depText}`,
      `Recommended action: ${report.sections.recommendedAction}`,
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.llm.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error(`[llm] OpenAI API error: ${response.status} ${response.statusText}`);
      return report;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const narrative = data.choices?.[0]?.message?.content?.trim();
    if (narrative) {
      return { ...report, narrative };
    }
  } catch (err) {
    console.error("[llm] Narrative enrichment failed:", err);
  }

  return report;
}
