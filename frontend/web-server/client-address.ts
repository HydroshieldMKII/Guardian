import { subscribe } from "node:diagnostics_channel";
import type { IncomingMessage } from "node:http";

const REQUEST_START_CHANNEL = "http.server.request.start";

export function appendClientAddress(request: IncomingMessage): void {
  const address = request.socket.remoteAddress;
  if (!address) {
    return;
  }

  const forwarded = [request.headers["x-forwarded-for"] ?? []].flat();
  request.headers["x-forwarded-for"] = [...forwarded, address].join(", ");
}

function carriesRequest(
  message: unknown,
): message is { request: IncomingMessage } {
  return (
    typeof message === "object" && message !== null && "request" in message
  );
}

export function forwardClientAddresses(): void {
  subscribe(REQUEST_START_CHANNEL, (message) => {
    if (carriesRequest(message)) {
      appendClientAddress(message.request);
    }
  });
}
