import * as path from 'path';
import * as vscode from 'vscode';

import { UpdatableTreeItem } from './updatable';
import fetch from 'node-fetch';


export class GitHubProvider implements vscode.TreeDataProvider<GitHubTreeItem> {
  private static apiToken: string = '';
  public static apiBase: string = 'https://api.github.com/';

  public static getGHjson(url: string, processJson: (json: any, resolveJson: any, rejectJson: any) => void) {
    GitHubProvider.apiToken = vscode.workspace.getConfiguration('openjdkDevel').get('github.apiToken', '');
    if (GitHubProvider.apiToken === '') {
      return Promise.reject(new Error('No GitHub API Token set'));
    }

    return new Promise<GitHubTreeItem[]>((resolve, reject) => fetch(url, {
      /* eslint-disable @typescript-eslint/naming-convention */
      headers: {
        'Authorization': 'token ' + GitHubProvider.apiToken,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'vscode-openjdk-devel'
      }
      /* eslint-enable @typescript-eslint/naming-convention */
    })
      .then(res => res.json())
      .then(json => {
        processJson(json, resolve, reject);
      })
      .catch((error: any) => {
        reject(new Error('GitHub Integration error: ' + error));
      }));
  }

  private onDidChangeTreeDataEmitter: vscode.EventEmitter<GitHubTreeItem | undefined> =
    new vscode.EventEmitter<GitHubTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<GitHubTreeItem | undefined> = this.onDidChangeTreeDataEmitter.event;

  private rootNodes: GitHubTreeItem[] = [];

  constructor() {
    if (!this.verifySettings()) {
      // An empty root set will trigger the welcome view
      return;
    }
    this.setupTree();
  }

  setupTree() {
    const alerts = new AlertsRootItem('Notifications', this.onDidChangeTreeDataEmitter);
    this.rootNodes.push(alerts);
    const prs = new PRsRootItem('My Pull Requests', this.onDidChangeTreeDataEmitter);
    this.rootNodes.push(prs);
  }

  getTreeItem(element: GitHubTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: GitHubTreeItem | undefined): vscode.ProviderResult<GitHubTreeItem[]> {
    if (element === undefined) {
      return this.rootNodes;
    }
    return element.getChildrenAny();
  }

  verifySettings(): boolean {
    const token = vscode.workspace.getConfiguration('openjdkDevel').get('github.apiToken', '');
    const username = vscode.workspace.getConfiguration('openjdkDevel').get('github.username', '');
    return token !== '' && username !== '';
  }

  userRefresh() {
    if (!this.verifySettings()) {
      // An empty root set will trigger the welcome view
      // Yes, setting length to 0 is valid javascript...
      this.rootNodes.length = 0;
      this.signalNeedForScreenRefresh();
      return;
    }

    if (this.rootNodes.length === 0) {
      this.setupTree();
    }

    this.rootNodes.forEach(node => node.reloadFromWeb(true));
    this.signalNeedForScreenRefresh();
  }

  signalNeedForScreenRefresh(item?: GitHubTreeItem): void {
    this.onDidChangeTreeDataEmitter.fire(item);
  }
}

abstract class GitHubTreeItem extends UpdatableTreeItem<GitHubTreeItem> {
  children: GitHubTreeItem[] = [];
  constructor(label: string, readonly id: string, collapsibleState: vscode.TreeItemCollapsibleState,
    eagerExpand: boolean, icon: string,
    onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>, children?: GitHubTreeItem[]) {
    super(label, id, collapsibleState, eagerExpand, onDidChangeTreeDataEmitter, children);
    this.iconPath = path.join(__filename, '..', '..', 'media', icon);
  }
}

class GitHubLeafTreeItem extends GitHubTreeItem {
  constructor(label: string, id: string, icon: string,
    onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>) {
    super(label, id, vscode.TreeItemCollapsibleState.None, false, icon, onDidChangeTreeDataEmitter);
  }

  protected loadChildrenArrayFromWeb(): Promise<GitHubTreeItem[]> {
    return Promise.resolve([]);
  }

  protected updateSelfAfterWebLoad(): void {
    // do nothing
  }
}

class AlertsRootItem extends GitHubTreeItem {
  constructor(label: string, onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>) {
    super(label, 'id', vscode.TreeItemCollapsibleState.Expanded, true,
      'github-notification.svg', onDidChangeTreeDataEmitter);
    this.description = '...';
  }

  protected loadChildrenArrayFromWeb(): Promise<GitHubTreeItem[]> {
    return GitHubProvider.getGHjson(GitHubProvider.apiBase + 'notifications',
      (json: any, resolveJson: any, rejectJson: any) => {
        const newAlerts: AlertTreeItem[] = [];

        for (const alert of json) {
          if (alert.unread && alert.repository.owner.login === 'openjdk') {
            const notInfo = new AlertTreeItem(alert.subject.title, 'alert-' + alert.id,
              alert.subject.latest_comment_url, alert.subject.url, new Date(alert.updated_at), alert.repository.full_name, this.onDidChangeTreeDataEmitter);
            newAlerts.push(notInfo);
          }
        }
        resolveJson(newAlerts);
      });
  }

  protected updateSelfAfterWebLoad() {
    this.description = this.children ? this.children.length + ' unread notifications' : 'No notifications';
  }
}

class AlertTreeItem extends GitHubTreeItem {
  constructor(label: string, id: string, private commentUrl: string, private prUrl: string, private updatedAt: Date,
      private repository: string, onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>) {
    super(label, id, vscode.TreeItemCollapsibleState.Collapsed, false, 'github-item.svg', onDidChangeTreeDataEmitter);
  }

  protected loadChildrenArrayFromWeb(): Promise<GitHubTreeItem[]> {
    return GitHubProvider.getGHjson(this.commentUrl, (comment: any, resolveJson: any, rejectJson: any) => {
      const newCommentInfo: GitHubTreeItem[] = [];

      // Stupid cleaning of html tags; will likely work ok since GitHub does the real work for us
      const cleanedComment = comment.body.replace(/<\/?[^>]+(>|$)/g, '').trim();

      const prNumber = this.prUrl.split('/').pop();

      let localeConf = vscode.workspace.getConfiguration('openjdkDevel').get('locale', '');
      let locale;
      if (localeConf === '') {
        locale = undefined;
      } else {
        locale = localeConf;
      }

      newCommentInfo.push(new GitHubLeafTreeItem(cleanedComment,
        this.commentUrl + '+comment', 'github-conversation.svg', this.onDidChangeTreeDataEmitter));

      newCommentInfo.push(new GitHubLeafTreeItem(comment.user.login,
        this.commentUrl + '+username', 'github-user.svg', this.onDidChangeTreeDataEmitter));

      newCommentInfo.push(new GitHubLeafTreeItem(this.updatedAt.toLocaleString(locale),
        this.commentUrl + '+date', 'github-time.svg', this.onDidChangeTreeDataEmitter));

      newCommentInfo.push(new GitHubLeafTreeItem(`${this.repository}#${prNumber}`,
        this.commentUrl + '+pr', 'github-pullrequest.svg', this.onDidChangeTreeDataEmitter));

      resolveJson(newCommentInfo);
    });
  }

  protected updateSelfAfterWebLoad() {
    // do nothing
  }
}

class PRsRootItem extends GitHubTreeItem {

  constructor(label: string, onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>) {
    super(label, 'id-prs' + label, vscode.TreeItemCollapsibleState.Expanded, true,
      'github-logo.svg', onDidChangeTreeDataEmitter);
    this.description = '...';
  }

  protected loadChildrenArrayFromWeb(): Promise<GitHubTreeItem[]> {
    const username = vscode.workspace.getConfiguration('openjdkDevel').get('github.username', '');
    return GitHubProvider.getGHjson(GitHubProvider.apiBase +
      'search/issues?q=is:open+is:pr+archived:false+repo:openjdk/jdk+author:' + username,
    (json: any, resolveJson: any, rejectJson: any) => {
      const items = json.items;
      const newPRs: PRTreeItem[] = [];

      for (const item of items) {
        const tags = item.labels.map((label: any) => label.name).join(' ');
        const itemInfo = new PRTreeItem(item.title, 'pr-' + item.id, item.html_url,
          item.repository_url.replace('https://api.github.com/repos/', ''),
          item.number, tags, item.user.login, item.pull_request.url,
          this.onDidChangeTreeDataEmitter);
        newPRs.push(itemInfo);
      }

      resolveJson(newPRs);
    });
  }

  protected updateSelfAfterWebLoad() {
    // Since we have changed our description, we need to always update
    this.description = this.children ? this.children.length + ' open pull requests' : 'No open pull requests';
  }
}

class PRTreeItem extends GitHubTreeItem {
  generated: GitHubTreeItem[] = [];
  diffItem: GitHubLeafTreeItem;
  convItem: GitHubLeafTreeItem;
  constructor(label: string, id: string, userReadableUrl: string, repo: string,
    prNumber: number, tags: string,
    author: string, private prUrl: string,

    onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>) {
    super(label, id, vscode.TreeItemCollapsibleState.Collapsed, false,
      'github-pullrequest.svg', onDidChangeTreeDataEmitter);
    this.tooltip = `${label}\n${repo}#${prNumber} by @${author}`;

    this.convItem = new GitHubLeafTreeItem(
      `${repo}#${prNumber} by @${author}`, 'goto' + id, 'github-conversation.svg', onDidChangeTreeDataEmitter
    );
    this.generated.push(this.convItem);
    // Diff description must be complemented from prUrl, which can only be done later
    this.diffItem = new GitHubLeafTreeItem('Diff', 'diff' + id, 'github-diff.svg', onDidChangeTreeDataEmitter);
    this.generated.push(this.diffItem);
    if (tags) {
      this.generated.push(new GitHubLeafTreeItem(tags, 'tags' + id, 'github-tags.svg', onDidChangeTreeDataEmitter));

    }
  }

  protected loadChildrenArrayFromWeb(): Promise<GitHubTreeItem[]> {
    return GitHubProvider.getGHjson(this.prUrl, (json: any, resolveJson: any, rejectJson: any) => {
      this.diffItem.label = `+${json.additions} -${json.deletions}, ${json.changed_files} changed files`;
      resolveJson(this.generated);
    });
  }
  protected updateSelfAfterWebLoad(): void {
    // do nothing
  }
}
