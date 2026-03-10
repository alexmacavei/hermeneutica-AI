import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AnalyzeService, AnalysisResult } from './analyze.service';
import { AnalyzeDto } from './dto/analyze.dto';

@Controller('analyze')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async analyze(@Body() dto: AnalyzeDto): Promise<AnalysisResult> {
    return this.analyzeService.analyze(dto);
  }
}
