import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AiModule } from '../ai/ai.module';
import { PatristicModule } from '../patristic/patristic.module';

@Module({
  imports: [AiModule, PatristicModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
