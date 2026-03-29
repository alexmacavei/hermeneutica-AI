import { IsString, IsOptional, MinLength } from 'class-validator';

export class AnalyzeDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsString()
  @MinLength(1)
  range!: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  translationId?: string;

  @IsOptional()
  @IsString()
  bookId?: string;
}
