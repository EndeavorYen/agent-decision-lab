export async function dispatchCommand(name, context, handlers) {
  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown command: ${name}`);
  }
  return handler(context);
}
