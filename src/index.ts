// Copyright (c) 2024 Cloudflare, Inc.
// Licensed under the MIT license found in the LICENSE file or at https://opensource.org/licenses/MIT

import { RealtimeClient } from "@openai/realtime-api-beta";

type Env = {
  OPENAI_API_KEY: string;
};

const DEBUG = false; // set as true to see debug logs
const MODEL = "gpt-4o-realtime-preview-2024-10-01";
const OPENAI_URL = "wss://api.openai.com/v1/realtime";

function owrLog(...args: unknown[]) {
  if (DEBUG) {
    console.log("[owr]", ...args);
  }
}

function owrError(...args: unknown[]) {
  console.error("[owr error]", ...args);
}

async function createRealtimeClient(
  request: Request,
  env: Env,
  ctx: ExecutionContext
) {
  const webSocketPair = new WebSocketPair();
  const [clientSocket, serverSocket] = Object.values(webSocketPair);

  serverSocket.accept();

  // Copy protocol headers
  const responseHeaders = new Headers();
  const protocolHeader = request.headers.get("Sec-WebSocket-Protocol");
  let apiKey = env.OPENAI_API_KEY;
  if (protocolHeader) {
    const requestedProtocols = protocolHeader.split(",").map((p) => p.trim());
    if (requestedProtocols.includes("realtime")) {
      // Not exactly sure why this protocol needs to be accepted
      responseHeaders.set("Sec-WebSocket-Protocol", "realtime");
    }
  }

  if (!apiKey) {
    owrError(
      "Missing OpenAI API key. Did you forget to set OPENAI_API_KEY in .dev.vars (for local dev) or with wrangler secret put OPENAI_API_KEY (for production)?"
    );
    return new Response("Missing API key", { status: 401 });
  }

  let realtimeClient: RealtimeClient | null = null;

  // Create RealtimeClient
  try {
    owrLog("Creating OpenAIRealtimeClient");
    realtimeClient = new RealtimeClient({
      apiKey,
      debug: DEBUG,
      url: OPENAI_URL,
    });
  } catch (e) {
    owrError("Error creating OpenAI RealtimeClient", e);
    serverSocket.close();
    return new Response("Error creating OpenAI RealtimeClient", {
      status: 500,
    });
  }

  // Relay: OpenAI Realtime API Event -> Client
  realtimeClient.realtime.on("server.*", (event: { type: string }) => {
    serverSocket.send(JSON.stringify(event));
  });

  realtimeClient.realtime.on("close", (metadata: { error: boolean }) => {
    owrLog(
      `Closing server-side because I received a close event: (error: ${metadata.error})`
    );
    serverSocket.close();
  });

  // Relay: Client -> OpenAI Realtime API Event
  const messageQueue: string[] = [];

  serverSocket.addEventListener("message", (event: MessageEvent) => {
    const messageHandler = (data: string) => {
      try {
        const parsedEvent = JSON.parse(data);
        realtimeClient.realtime.send(parsedEvent.type, parsedEvent);
      } catch (e) {
        owrError("Error parsing event from client", data);
      }
    };

    const data =
      typeof event.data === "string" ? event.data : event.data.toString();
    if (!realtimeClient.isConnected()) {
      messageQueue.push(data);
    } else {
      messageHandler(data);
    }
  });

  serverSocket.addEventListener("close", ({ code, reason }) => {
    owrLog(
      `Closing server-side because the client closed the connection: ${code} ${reason}`
    );
    realtimeClient.disconnect();
    messageQueue.length = 0;
  });

  let model: string | undefined = MODEL;

  // uncomment this to use a model from specified by the client

  // const modelParam = new URL(request.url).searchParams.get("model");
  // if (modelParam) {
  //   model = modelParam;
  // }

  // Connect to OpenAI Realtime API
  try {
    owrLog(`Connecting to OpenAI...`);
    // @ts-expect-error Waiting on https://github.com/openai/openai-realtime-api-beta/pull/52
    await realtimeClient.connect({ model });
    owrLog(`Connected to OpenAI successfully!`);
    while (messageQueue.length) {
      const message = messageQueue.shift();
      if (message) {
        serverSocket.send(message);
      }
    }
  } catch (e) {
    owrError("Error connecting to OpenAI", e);
    return new Response("Error connecting to OpenAI", { status: 500 });
  }

  return new Response(null, {
    status: 101,
    headers: responseHeaders,
    webSocket: clientSocket,
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // This would be a good place to add logic for
    // authentication, rate limiting, etc.
    // You could also do matching on the path or other things here.
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      return createRealtimeClient(request, env, ctx);
    }

    return new Response("Expected Upgrade: websocket", { status: 426 });
  },
};
