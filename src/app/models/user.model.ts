export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface UserCredentials {
  username: string;
  passwordHash: string;
}

export interface StoredUserAccount extends User {
  passwordHash: string;
}
