export class Token {
    expiration: number;
    constructor(public googleToken: google.accounts.oauth2.TokenResponse) {
        this.expiration = Date.now() + Number(googleToken.expires_in) * 1000 - 60000;
    }
}
