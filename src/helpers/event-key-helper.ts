export function eventKeyHelper(clientRequestId: string, prefix: 'error' | 'response') {
  return `${prefix}-${clientRequestId}`;
}
