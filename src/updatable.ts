import * as vscode from 'vscode';
import fetch from 'node-fetch';

const TIMEOUT_DELAY = 30000;

export abstract class UpdatableProvider implements vscode.TreeDataProvider<UpdatableTreeItem> {
  private onDidChangeTreeDataEmitter: vscode.EventEmitter<UpdatableTreeItem | undefined> =
    new vscode.EventEmitter<UpdatableTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<UpdatableTreeItem | undefined> =
    this.onDidChangeTreeDataEmitter.event;

  private rootNodes: UpdatableTreeItem[] = [];

  constructor() {
    if (!this.verifySettings()) {
      // An empty root set will trigger the welcome view
      return;
    }
    this.rootNodes = this.setupTree();
  }

  public getTreeItem(element: UpdatableTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  public getChildren(element?: UpdatableTreeItem | undefined):
    vscode.ProviderResult<UpdatableTreeItem[]> {
    if (element === undefined) {
      return this.rootNodes;
    }
    return element.getChildrenAny();
  }

  public userRefresh(forceReload?: boolean) {
    if (!this.verifySettings()) {
      // An empty root set will trigger the welcome view
      // Yes, setting length to 0 is valid javascript...
      this.rootNodes.length = 0;
      this.signalNeedForScreenRefresh();
      return;
    }

    if (forceReload) {
      // Remove all root nodes and recreate them below
      this.rootNodes.length = 0;
    }

    if (this.rootNodes.length === 0) {
      this.setupTree();
    }

    this.rootNodes.forEach(node => node.reloadFromWeb(true));
    this.signalNeedForScreenRefresh();
  }

  protected abstract setupTree(): UpdatableTreeItem[];

  protected abstract verifySettings(): boolean;

  public signalNeedForScreenRefresh(item?: UpdatableTreeItem): void {
    this.onDidChangeTreeDataEmitter.fire(item);
  }
}

export abstract class UpdatableTreeItem extends vscode.TreeItem {
  private isPopulated: boolean = false;
  private isCurrentlyUpdating: boolean = false;
  private readonly onChangeEmitter: vscode.EventEmitter<undefined> = new vscode.EventEmitter<undefined>();
  private readonly onChange: vscode.Event<undefined> = this.onChangeEmitter.event;
  protected children: UpdatableTreeItem[];

  public timeoutDelay: number = TIMEOUT_DELAY;

  constructor(label: string, readonly id: string, collapsibleState: vscode.TreeItemCollapsibleState,
    readonly eagerExpand: boolean,
    protected provider: UpdatableProvider,
    children?: UpdatableTreeItem[]) {
    super(label, collapsibleState);
    this.children = children ? children : [];
  }

  protected updateViewOnScreen() {
    this.provider.signalNeedForScreenRefresh(this);
  }

  public getChildrenAny(): Promise<UpdatableTreeItem[]> {
    if (!this.isPopulated) {
      if (!this.eagerExpand) {
        // unless we have eager expand, we should wait for the update to
        // take place before returning
        this.isCurrentlyUpdating = true;
      }
      // we're creating it for the first time,  add task to populate
      // in background (and then signal we're done)
      this.updateFromWeb();
    }

    if (this.isCurrentlyUpdating) {
      // this is an update of an existing tree; make sure we show spinner
      return new Promise(resolve => {
        this.onChange(() => {
          resolve(this.children);
        });
      });
    } else {
      // return what we got, wether it's empty or populated, to have it show
      // up early in the interface
      return Promise.resolve(this.children);
    }
  }

  public reloadFromWeb(userAction: boolean): void {
    this.isCurrentlyUpdating = true;
    if (userAction) {
      // update to show spinner
      this.updateViewOnScreen();
    }
    // request update in background
    this.updateFromWeb();
  }

  protected abstract loadChildrenArrayFromWeb(): Promise<UpdatableTreeItem[]>;

  protected abstract updateSelfAfterWebLoad(): void;

  private updateFromWeb() {
    Promise.race([this.loadChildrenArrayFromWeb(),
      new Promise<UpdatableTreeItem[]>((resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timed out after ${this.timeoutDelay} ms.`));
        }, this.timeoutDelay);
      })])
      .then(loadedArray => {
        this.updateChildren(this.children, loadedArray, updatedArray => {
          if (updatedArray) {
            this.children = updatedArray;
          }
        });
      })
      .catch(failure => {
        console.error(failure);
        vscode.window.showErrorMessage('Error in OpenJDK Dev extension: ' +
          (failure.message ? failure.message : failure));
      })
      .finally(() => {
        // we are done loading from the web!
        const shouldUpdate = this.isPopulated;
        this.isPopulated = true;
        if (this.isCurrentlyUpdating) {
          this.isCurrentlyUpdating = false;
          // signal that loading is done
          this.onChangeEmitter.fire(undefined);
        }

        this.updateSelfAfterWebLoad();
        if (this.eagerExpand || shouldUpdate) {
          // if this was the load to populate, we cannot update now,
          // since we have already returned a promise waiting on the
          // onChangeEmitter
          this.updateViewOnScreen();
        }
      });
  }

  private updateChildren(oldArray: UpdatableTreeItem[], newArray: UpdatableTreeItem[],
    onUpdate: (updatedArray: UpdatableTreeItem[] | undefined) => void) {
    let updated = false;
    // Remove elements that has disappeared in the newArray
    const updatedArray = oldArray.filter(oldElem => {
      const isInNew = newArray.find(newElem => newElem.id === oldElem.id);
      if (!isInNew) {
        // Element will be removed, so flag updatedArray as changed
        updated = true;
      }
      return isInNew;
    });

    // Add new elements that is not in the oldArray
    newArray.forEach(newElem => {
      if (!oldArray.find(oldElem => oldElem.id === newElem.id)) {
        updated = true;
        updatedArray.push(newElem);
      }
    });

    if (updated) {
      onUpdate(updatedArray);
    } else {
      onUpdate(undefined);
    }
  }
}

export class UpdatableDownloader<T extends UpdatableTreeItem> {
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
