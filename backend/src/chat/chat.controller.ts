import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ChatRequestDto, ChatResponseDto } from './chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  async sendMessage(@Body() dto: ChatRequestDto): Promise<ChatResponseDto> {
    const reply = await this.chatService.sendMessage(
      dto.message,
      dto.history ?? [],
    );
    return { reply };
  }
}
