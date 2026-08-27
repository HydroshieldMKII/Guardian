export const DEFAULT_BLOCK_MESSAGES = {
  devicePending:
    'This device is waiting for approval. The server owner has to approve it before you can stream from it.',
  deviceRejected:
    'This device is not allowed to stream. Contact the server owner if you think that is a mistake.',
  timeRestricted:
    'Streaming is not allowed right now. A schedule set by the server owner blocks this time of day.',
  lanOnly:
    'Streaming is only allowed on the local network. Connect to the local network and try again.',
  wanOnly:
    'Streaming is only allowed from outside the local network. Connect from the internet and try again.',
  notAllowed:
    'Streaming is not allowed from your current IP address. Contact the server owner to have it added.',
  concurrentLimit:
    'You have reached your limit of streams at the same time. Stop another stream before starting this one.',
} as const;
