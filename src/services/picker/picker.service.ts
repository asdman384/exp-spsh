/// <reference types="gapi" />
/// <reference types="google.picker" />

import { Injectable } from '@angular/core';

import { Observable, map, switchMap } from 'rxjs';

import keys from '../../../keys.json';
import { AbstractSecurityService } from '../security';

@Injectable({ providedIn: 'root' })
export class PickerService {
  private pickerApi: Promise<void> | undefined;

  constructor(private readonly security: AbstractSecurityService) {}

  /**
   * Opens the Google Picker restricted to Sheets, scoped to `drive.file` access: the user
   * explicitly grants the app access to whichever file they pick here, rather than to every
   * spreadsheet they own.
   * @returns the picked file id, or `undefined` if the user cancelled
   */
  pickSpreadsheet(): Observable<string | undefined> {
    return this.security.refreshToken().pipe(
      map((token) => token.access_token),
      switchMap((accessToken) => this.openPicker(accessToken))
    );
  }

  private openPicker(accessToken: string): Observable<string | undefined> {
    return new Observable<string | undefined>((subscriber) => {
      this.loadPickerApi().then(() => {
        const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMode(
          google.picker.DocsViewMode.LIST
        );

        new google.picker.PickerBuilder()
          .setOAuthToken(accessToken)
          .setDeveloperKey(keys.API_KEY)
          .setAppId(keys.APP_ID)
          .addView(view)
          .setCallback((response: google.picker.ResponseObject) => {
            const action = response[google.picker.Response.ACTION];
            if (action === google.picker.Action.PICKED) {
              const doc = response[google.picker.Response.DOCUMENTS]?.[0];
              subscriber.next(doc?.[google.picker.Document.ID]);
              subscriber.complete();
            } else if (action === google.picker.Action.CANCEL) {
              subscriber.next(undefined);
              subscriber.complete();
            }
          })
          .build()
          .setVisible(true);
      }, (error) => subscriber.error(error));
    });
  }

  private loadPickerApi(): Promise<void> {
    if (!this.pickerApi) {
      this.pickerApi = this.loadGapi().then(() => new Promise<void>((resolve) => gapi.load('picker', () => resolve())));
    }
    return this.pickerApi;
  }

  private loadGapi(): Promise<void> {
    if (typeof gapi !== 'undefined') return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Picker API script'));
      document.head.appendChild(script);
    });
  }
}
