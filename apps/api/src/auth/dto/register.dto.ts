import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { UserRole } from '@amplyra/shared';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsIn([UserRole.BUSINESS, UserRole.CREATOR])
  role!: UserRole.BUSINESS | UserRole.CREATOR;
}
