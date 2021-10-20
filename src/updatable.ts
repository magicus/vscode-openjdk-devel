import * as vscode from 'vscode';

const TIMEOUT_DELAY = 30000;

function updateChildren<CT extends vscode.TreeItem>(oldArray: CT[], newArray: CT[],
  onUpdate: (updatedArray: CT[] | undefined) => void) {
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

export abstract class UpdatableTreeItem<CT extends vscode.TreeItem> extends vscode.TreeItem {
  private isPopulated: boolean = false;
  private isCurrentlyUpdating: boolean = false;
  private readonly onChangeEmitter: vscode.EventEmitter<undefined> = new vscode.EventEmitter<undefined>();
  private readonly onChange: vscode.Event<undefined> = this.onChangeEmitter.event;
  protected children: CT[];

  public timeoutDelay: number = TIMEOUT_DELAY;

  constructor(label: string, readonly id: string, collapsibleState: vscode.TreeItemCollapsibleState,
    readonly eagerExpand: boolean,
    protected onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>, children?: CT[]) {
    super(label, collapsibleState);
    this.children = children ? children : [];
  }

  protected updateViewOnScreen() {
    this.onDidChangeTreeDataEmitter.fire(this);
  }

  public getChildrenAny(): Promise<CT[]> {
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

  public reloadFromWeb(userAction: boolean) {
    this.isCurrentlyUpdating = true;
    if (userAction) {
      // update to show spinner
      this.updateViewOnScreen();
    }
    // request update in background
    this.updateFromWeb();
  }

  protected abstract loadChildrenArrayFromWeb(): Promise<CT[]>;

  protected abstract updateSelfAfterWebLoad(): void;

  private updateFromWeb() {
    Promise.race([this.loadChildrenArrayFromWeb(),
      new Promise<CT[]>((resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timed out after ${this.timeoutDelay} ms.`));
        }, this.timeoutDelay);
      })])
      .then(loadedArray => {
        updateChildren<CT>(this.children, loadedArray, updatedArray => {
          if (updatedArray) {
            this.children = updatedArray;
          }
        });
      })
      .catch(failure => {
        console.error(failure);
        vscode.window.showErrorMessage(failure);
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
}
