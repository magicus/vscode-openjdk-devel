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
