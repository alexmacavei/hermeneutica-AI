import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotesService } from './notes.service';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  verse_reference!: string;

  @IsString()
  @IsNotEmpty()
  note_text!: string;
}

export class UpdateNoteDto {
  @IsString()
  @IsNotEmpty()
  note_text!: string;
}

interface AuthRequest extends Request {
  user: { id: number; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Body() dto: CreateNoteDto, @Request() req: AuthRequest) {
    return this.notesService.create(
      req.user.id,
      dto.verse_reference,
      dto.note_text,
    );
  }

  @Get()
  findByVerse(
    @Query('verse_reference') verseRef: string,
    @Request() req: AuthRequest,
  ) {
    return this.notesService.findByVerse(req.user.id, verseRef ?? '');
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNoteDto,
    @Request() req: AuthRequest,
  ) {
    const note = await this.notesService.update(id, req.user.id, dto.note_text);
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthRequest,
  ) {
    const deleted = await this.notesService.delete(id, req.user.id);
    if (!deleted) throw new NotFoundException('Note not found');
    return { success: true };
  }
}
