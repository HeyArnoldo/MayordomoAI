/**
 * @app/mcp-server — Stateless Streamable HTTP MCP server
 *
 * Exposes 3 MayordomoAI finance tools to Azure AI Foundry agents via the
 * Model Context Protocol (Streamable HTTP transport, stateless mode).
 *
 * ─── curl smoke tests ──────────────────────────────────────────────────────
 *
 * 1. Missing auth → 401:
 *    curl -v -X POST http://localhost:3001/mcp
 *
 * 2. Wrong auth → 401:
 *    curl -v -X POST http://localhost:3001/mcp \
 *      -H "Authorization: Bearer wrong-token"
 *
 * 3. Unknown route → 404:
 *    curl -v http://localhost:3001/unknown
 *    curl -v -X POST http://localhost:3001/tools
 *
 * 4. MCP initialize (replace <token> with MCP_AUTH_TOKEN):
 *    curl -X POST http://localhost:3001/mcp \
 *      -H "Authorization: Bearer <token>" \
 *      -H "Content-Type: application/json" \
 *      -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'
 *
 * 5. Tool call — getBoxBalances (after initialize):
 *    curl -X POST http://localhost:3001/mcp \
 *      -H "Authorization: Bearer <token>" \
 *      -H "Content-Type: application/json" \
 *      -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"getBoxBalances","arguments":{}}}'
 *
 * 6. Backend direct call (for debugging — replace <key> with AGENT_TOOL_INTERNAL_KEY):
 *    curl -X POST http://localhost:3000/api/agent-tools/get-box-balances \
 *      -H "Content-Type: application/json" \
 *      -H "x-agent-tool-key: <key>" \
 *      -d '{}'
 *
 * ─── Connecting in Azure AI Foundry ───────────────────────────────────────
 * 1. Expose with ngrok: ngrok http 3001
 * 2. In Foundry: Tools → Add → Custom → MCP
 *    URL: https://<ngrok-id>.ngrok-free.app/mcp
 *    Auth: Bearer token → MCP_AUTH_TOKEN value
 * ───────────────────────────────────────────────────────────────────────────
 */

import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from './config.js';
import { checkBearer } from './auth.js';
import { tools } from './tools/index.js';

// ---------------------------------------------------------------------------
// Build and configure the MCP server (created once, shared across requests).
// In stateless mode, per-request transports are spun up/down independently.
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'mayordomoai-mcp-server',
  version: '0.1.0',
});

for (const t of tools) {
  server.registerTool(
    t.name,
    { description: t.description, inputSchema: t.inputShape },
    t.handler as Parameters<typeof server.registerTool>[2],
  );
}

// ---------------------------------------------------------------------------
// HTTP server — pure Node.js (no Express dependency)
// ---------------------------------------------------------------------------

const httpServer = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/mcp') {
    // Bearer auth BEFORE handing to the transport — 401 on fail.
    if (!checkBearer(req)) {
      console.log('[mcp-server] Rejected request: invalid or missing bearer token');
      res
        .writeHead(401, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    console.log('[mcp-server] MCP POST /mcp — processing request');

    // Read and parse the request body before passing to the transport.
    let parsedBody: unknown;
    try {
      const rawBody = await readBody(req);
      parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
    } catch {
      res
        .writeHead(400, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    // Create a stateless transport per request (ADR-5: stateless Streamable HTTP).
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Clean up the transport when the connection closes.
    res.on('close', () => {
      transport.close().catch(() => {
        // Ignore close errors — connection already gone.
      });
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
    } catch (err) {
      console.error(
        '[mcp-server] Error handling MCP request:',
        err instanceof Error ? err.message : 'unknown error',
      );
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' }).end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          }),
        );
      }
    }
    return;
  }

  // Unknown routes → 404 (spec requirement).
  res
    .writeHead(404, { 'Content-Type': 'application/json' })
    .end(JSON.stringify({ error: 'Not found' }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { IncomingMessage } from 'node:http';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------

httpServer.listen(config.PORT, () => {
  console.log(`[mcp-server] Listening on port ${config.PORT}`);
  console.log(`[mcp-server] MCP endpoint: POST http://localhost:${config.PORT}/mcp`);
  console.log(`[mcp-server] Backend: ${config.MAYORDOMO_API_BASE_URL}`);
});

httpServer.on('error', (err) => {
  console.error('[mcp-server] Server error:', err.message);
  process.exit(1);
});
