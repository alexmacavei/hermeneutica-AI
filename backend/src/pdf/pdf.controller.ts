import {
  Body,
  Controller,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PdfService } from './pdf.service';

class NoteDto {
  @IsString()
  @IsOptional()
  note_title?: string;

  @IsString()
  @IsNotEmpty()
  note_text!: string;

  @IsString()
  @IsNotEmpty()
  created_at!: string;
}

class CardsDto {
  @IsString()
  @IsNotEmpty()
  hermeneutics!: string;

  @IsString()
  @IsNotEmpty()
  philosophy!: string;

  @IsString()
  @IsNotEmpty()
  patristics!: string;

  @IsString()
  @IsNotEmpty()
  philology!: string;
}

class ExportPdfRequestDto {
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsString()
  @IsNotEmpty()
  language!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CardsDto)
  cards!: CardsDto;

  @IsString()
  @IsNotEmpty()
  timestamp!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteDto)
  notes!: NoteDto[];
}

@UseGuards(JwtAuthGuard)
@Controller('pdf')
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(private readonly pdfService: PdfService) {}

  @Post('export')
  @HttpCode(200)
  async exportPdf(
    @Body() dto: ExportPdfRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const pdfBuffer = await this.pdfService.generatePdf(dto);
      const filename = `analiza-${dto.reference.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
      });
      res.end(pdfBuffer);
    } catch (err) {
      this.logger.error('PDF generation failed', err);
      throw new InternalServerErrorException('PDF generation failed');
    }
  }
}
