export class Userinfo implements gapi.client.oauth2.Userinfo {
  /** The user's email address. */
  email?: string;
  /** The user's last name. */
  family_name?: string;
  /** The user's gender. */
  gender?: string;
  /** The user's first name. */
  given_name?: string;
  /** The hosted domain e.g. example.com if the user is Google apps user. */
  hd?: string;
  /** The obfuscated ID of the user. */
  id: string;
  /** URL of the profile page. */
  link?: string;
  /** The user's preferred locale. */
  locale?: string;
  /** The user's full name. */
  name: string;
  /** URL of the user's picture image. */
  picture?: string;
  /** Boolean flag which is true if the email address is verified. Always verified because we only return the user's primary email address. */
  verified_email?: boolean;

  constructor(obj: gapi.client.oauth2.Userinfo) {
    this.id = '';
    this.name = '';
    Object.assign(this, obj);
  }
}
