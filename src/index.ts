import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { scanSubject } from "./scanner.js";

const server = new Server(
  { name: "warden", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// --- Tool Schemas ---
const ScanSubjectSchema = z.object({
  identifier: z
    .string()
    .min(1)
    .describe("Email address or user ID to scan across all data systems"),
});

// --- Tool Registry ---
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "scan_subject",
      description:
        "Scan all connected data systems for records matching the given identifier (email or user ID). Returns aggregated hits with sensitivity tags.",
      inputSchema: {
        type: "object" as const,
        properties: {
          identifier: {
            type: "string",
            description: "Email address or user ID to scan",
          },
        },
        required: ["identifier"],
      },
    },
  ],
}));

// --- Tool Handler ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "scan_subject") {
    const parsed = ScanSubjectSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          { type: "text" as const, text: `Invalid input: ${parsed.error.message}` },
        ],
        isError: true,
      };
    }

    try {
      const result = await scanSubject(parsed.data.identifier);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      console.error("[warden] scan_subject error:", err);
      return {
        content: [
          {
            type: "text" as const,
            text: `Scan failed: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

// --- Start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[warden] MCP server running on stdio");
}

main().catch((err) => {
  console.error("[warden] Fatal startup error:", err);
  process.exit(1);
});
