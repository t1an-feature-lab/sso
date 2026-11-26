export type PublicUser = {
  id: string;
  username: string;
  avatarUrl: string;
  phone: string | null;
  role: "admin" | "user";
  createdAt: string;
};

export type ManagedUser = PublicUser & {
  isBuiltIn: boolean;
};

export type ClientApplication = {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  clientId: string;
  logoUrl: string;
  redirectUris: string[];
  scopes: string[];
  homepage: string;
  status: "active" | "disabled";
  createdAt: string;
};

export type ClientSecret = {
  id: string;
  lastFour: string;
  canReveal: boolean;
  createdAt: string;
  createdBy: string;
  lastUsedAt: string | null;
};

export type AuthorizedApplicationUser = {
  id: string;
  userId: string;
  username: string;
  phone: string | null;
  scopes: string[];
  authorizedAt: string;
  lastUsedAt: string | null;
};

export type ClientApplicationDetail = ClientApplication & {
  clientSecrets: ClientSecret[];
  authorizedUsers: AuthorizedApplicationUser[];
};

export type ActionState = {
  success?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
  secretId?: string;
  clientSecret?: string;
};
