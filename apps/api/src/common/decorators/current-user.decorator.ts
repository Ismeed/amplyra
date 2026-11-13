import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@amplyra/shared';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
