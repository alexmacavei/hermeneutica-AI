import { IsString, MinLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class VerseDto {
  @IsString()
  @MinLength(1)
  number!: string;

  @IsString()
  @MinLength(1)
  text!: string;
}

export class IngestChapterDto {
  @IsString()
  @MinLength(1)
  bookName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerseDto)
  verses!: VerseDto[];
}
