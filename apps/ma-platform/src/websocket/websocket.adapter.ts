import { INestApplicationContext } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';

export class WebSocketAdapter extends WsAdapter {
  constructor(app: INestApplicationContext) {
    super(app);
  }
}
