'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatInfoBody, useChatInfoModel } from '@/components/chat/chat-info-shared';

interface Props {
  chatId: string;
  initialTitle?: string;
  open: boolean;
  onClose: () => void;
}

export function ChatInfoDialog({ chatId, initialTitle = 'Чат', open, onClose }: Props) {
  const model = useChatInfoModel(chatId, open, initialTitle);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Информация о чате</DialogTitle>
        </DialogHeader>
        <ChatInfoBody model={model} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
