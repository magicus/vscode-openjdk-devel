import * as vscode from 'vscode';



export class ConfigurationProvider implements vscode.TreeDataProvider<ConfigurationTreeItem> {
  private static apiToken: string = '';
  public static apiBase: string = 'https://api.github.com/';



  private onDidChangeTreeDataEmitter: vscode.EventEmitter<ConfigurationTreeItem | undefined> =
    new vscode.EventEmitter<ConfigurationTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<ConfigurationTreeItem | undefined> = this.onDidChangeTreeDataEmitter.event;

  private rootNodes: ConfigurationTreeItem[] = [];

  constructor() {
    if (!this.verifySettings()) {
      // An empty root set will trigger the welcome view
      return;
    }
    this.setupTree();
  }

  setupTree() {
    /*
    const alerts = new AlertsRootItem('Notifications', this.onDidChangeTreeDataEmitter);
    this.rootNodes.push(alerts);
    const username = vscode.workspace.getConfiguration('openjdkDevel').get('github.username', '');
    const myPRs = new PRsRootItem('My PRs', 'id-my-prs', 'is:open+is:pr+archived:false+org:openjdk+author:' + username,
      this.onDidChangeTreeDataEmitter);
    this.rootNodes.push(myPRs);

    const labelFilter = vscode.workspace.getConfiguration('openjdkDevel').get('labelFilter', '');
    const jdkPRs = new PRsRootItem('PRs for ' + labelFilter, 'id-open-prs',
      'is:open+is:pr+archived:false+label:rfr+org:openjdk+label:' + labelFilter,
      this.onDidChangeTreeDataEmitter);
    this.rootNodes.push(jdkPRs);
    */
  }

  getTreeItem(element: ConfigurationTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: ConfigurationTreeItem | undefined): vscode.ProviderResult<ConfigurationTreeItem[]> {
    if (element === undefined) {
      return this.rootNodes;
    }
    // return element.getChildrenAny();
  }

  verifySettings(): boolean {
    const token = vscode.workspace.getConfiguration('openjdkDevel').get('github.apiToken', '');
    const username = vscode.workspace.getConfiguration('openjdkDevel').get('github.username', '');
    const labelFilter = vscode.workspace.getConfiguration('openjdkDevel').get('labelFilter', '');
    return token !== '' && username !== '' && labelFilter !== '';
  }

  userRefresh(forceReload?: boolean) {
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

    // this.rootNodes.forEach(node => node.reloadFromWeb(true));
    this.signalNeedForScreenRefresh();
  }

  signalNeedForScreenRefresh(item?: ConfigurationTreeItem): void {
    this.onDidChangeTreeDataEmitter.fire(item);
  }
}


abstract class ConfigurationTreeItem extends vscode.TreeItem {
  children: ConfigurationTreeItem[] = [];
  constructor(label: string, readonly id: string, collapsibleState: vscode.TreeItemCollapsibleState,
    eagerExpand: boolean, icon: string,
    onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>, children?: ConfigurationTreeItem[]) {
    super(label, collapsibleState);
    //this.iconPath = path.join(__filename, '..', '..', 'media', icon);
  }
}