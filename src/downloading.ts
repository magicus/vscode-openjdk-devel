import * as vscode from 'vscode';

import fetch from 'node-fetch';

export class JsonDownloader<T> {
  protected getAuthorization(): string | undefined {
    return undefined;
  }

  protected getExtraHeaders(): Record<string, string> | undefined {
    return undefined;
  }

  private getHeaders(): Record<string, string> {
    /* eslint-disable @typescript-eslint/naming-convention */
    var allHeaders: Record<string, string> = {
      'User-Agent': 'vscode-openjdk-devel'
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    var auth = this.getAuthorization();
    if (auth) {
      /* eslint-disable @typescript-eslint/naming-convention */
      allHeaders = { ...allHeaders, 'Authorization': auth };
      /* eslint-enable @typescript-eslint/naming-convention */
    }

    var extraHeaders = this.getExtraHeaders();
    if (extraHeaders !== undefined) {
      allHeaders = { ...allHeaders, ...extraHeaders };
    }
    return allHeaders;
  }

  public getJson(url: string,
    processJson: (json: any) => Promise<T[]>,
    processError?: (error: Error) => Promise<T[]>): Promise<T[]> {
    try {
      const headers: Record<string, string> = this.getHeaders();

      return fetch(url, { headers: headers })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Server response: ${res.statusText} for ${url}`);
          }
          return res.json();
        })
        .then(json => processJson(json))
        .catch((error: Error) => {
          console.error('UpdatableDownloader error: ' + error);
          if (processError) {
            return processError(error);
          }
          return Promise.reject(error);
        });
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

export class DownloadableContentProvider implements vscode.TextDocumentContentProvider {
  constructor(readonly urlPrefix: string) {
  }

  public register(context: vscode.ExtensionContext) {
    var reg = vscode.workspace.registerTextDocumentContentProvider(this.urlPrefix, this);
    context.subscriptions.push(reg);
  }

  public getDownloadableUrl(url: string, title: string): string {
    return this.urlPrefix + ':' + decodeURIComponent(url) + '/name/' + title;
  }

  public openUrlInEditor(url: string, title: string) {
    const wrappedUrl = vscode.Uri.parse(this.getDownloadableUrl(url, title));

    vscode.window.showTextDocument(wrappedUrl);
  }

  private getWrappedUrl(url: string): string {
    return decodeURIComponent(url.replace(new RegExp('^' + this.urlPrefix + ':'),
      '').replace(/\/name\/.*$/, ''));
  }

  public provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const realUrl = this.getWrappedUrl(uri.toString());

    return this.asyncDownload(realUrl);
  }

  private async asyncDownload(url: string): Promise<string> {
    try {
      const response = await fetch(url);

      if (response.ok) {
        const fileContent = await response.text();
        return fileContent;
      } else {
        console.error('Error reading from ' + url + ':', response.statusText);
        return Promise.reject(response.statusText);
      }
    } catch (error) {
      console.error('Error fetching from ' + url + ':', error);
      return Promise.reject(error);
    }
  }
}
