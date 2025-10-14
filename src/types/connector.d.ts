// export type TokenEndPointResponse = {
//   success: boolean;
//   response: TokenResponse;
// };

// export type TokenResponse = {
//   access_token?: string;
//   refresh_token?: string;
//   expires_in?: number;
//   token_type?: string;
//   error?: string;
//   error_description?: string;
// };

export type StoredToken = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type: string;
};

export type ProviderConfig = {
  authUrl: string;
  tokenUrl: string;
  deviceUrl: string;
  revokeUrl?: string;
  userInfoUrl: string;
  scopes: string[];
};
