/**
 * Кэш загруженных чатов для предотвращения дублирующих запросов messages
 * (MessageList и MessageInput оба вызывают useMessages с одним chatId).
 * Сбрасывается при выходе из аккаунта.
 */
const loadedChatIds = new Set<string>();

/** Сообщения, уже добавленные через WebSocket — предотвращает дубли при быстрой повторной доставке. */
export const addedViaWs = new Set<string>();

export function hasLoadedChat(chatId: string): boolean {
  return loadedChatIds.has(chatId);
}

export function markChatLoaded(chatId: string): void {
  loadedChatIds.add(chatId);
}

export function unmarkChatLoaded(chatId: string): void {
  loadedChatIds.delete(chatId);
}

export function clearAddedViaWs(): void {
  addedViaWs.clear();
}

export function clearMessageCache(): void {
  loadedChatIds.clear();
  addedViaWs.clear();
}
