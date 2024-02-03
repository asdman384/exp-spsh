export interface GoogleToken {
  access_token: string;
  expires_in: string;
}

export class Token {
  expiration: number;
  constructor(public googleToken: GoogleToken) {
    this.expiration = Date.now() + Number(googleToken.expires_in) * 1000 - 60000;
  }
}
