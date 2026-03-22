export interface Bot {
  id: string;
  ownerId: string;
  username: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  token: string;
  webhookUrl: string | null;
  isInline: boolean;
  commands: BotCommand[];
  createdAt: Date;
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface InlineKeyboardButton {
  text: string;
  callbackData?: string;
  url?: string;
  webAppUrl?: string;
  switchInlineQuery?: string;
}

export interface ReplyKeyboardButton {
  text: string;
  requestContact?: boolean;
  requestLocation?: boolean;
}

export interface InlineKeyboard {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface ReplyKeyboard {
  keyboard: ReplyKeyboardButton[][];
  resizeKeyboard?: boolean;
  oneTimeKeyboard?: boolean;
  placeholder?: string;
}

export interface BotUpdate {
  updateId: number;
  message?: import('./message').Message;
  callbackQuery?: CallbackQuery;
  inlineQuery?: InlineQuery;
}

export interface CallbackQuery {
  id: string;
  from: import('./user').UserProfile;
  message: import('./message').Message;
  data: string;
}

export interface InlineQuery {
  id: string;
  from: import('./user').UserProfile;
  query: string;
  offset: string;
}
