'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInfoBody, useChatInfoModel } from '@/components/chat/chat-info-shared';

interface Props {
  chatId: string;
  initialTitle?: string;
  onClose: () => void;
}

export function ChatInfoPanel({ chatId, initialTitle = 'Чат', onClose }: Props) {
  const model = useChatInfoModel(chatId, true, initialTitle);

  return (
    <aside className="hidden lg:flex w-[360px] border-l border-border bg-card h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Информация о чате</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
        <ChatInfoBody model={model} onClose={onClose} />
      </div>
    </aside>
  );
}
