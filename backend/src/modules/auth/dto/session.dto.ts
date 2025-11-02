export class SessionDto {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export class AuthResponseDto {
  user: {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string;
  };
  session: SessionDto;
}

export class UserDto {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
}
