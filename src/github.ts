import * as path from 'path';
import * as vscode from 'vscode';

import { UpdatableProvider, UpdatableTreeItem  } from './updatable';
import fetch from 'node-fetch';


export class GitHubProvider extends UpdatableProvider {
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

  protected verifySettings(): boolean {
    const token = vscode.workspace.getConfiguration('openjdkDevel').get('github.apiToken', '');
    const username = vscode.workspace.getConfiguration('openjdkDevel').get('github.username', '');
    const labelFilter = vscode.workspace.getConfiguration('openjdkDevel').get('labelFilter', '');
    const repoFilter = vscode.workspace.getConfiguration('openjdkDevel').get('repoFilter', '');
    return token !== '' && username !== '' && (labelFilter !== '' || repoFilter !== '');
  }

  protected setupTree(): UpdatableTreeItem[] {
    const rootNodes: GitHubTreeItem[] = [];

    const alerts = new AlertsRootItem('Notifications', this);
    rootNodes.push(alerts);
    const username = vscode.workspace.getConfiguration('openjdkDevel').get('github.username', '');
    const myPRs = new PRsRootItem('My PRs', 'id-my-prs', 'is:open+is:pr+archived:false+org:openjdk+author:' + username,
      this);
    rootNodes.push(myPRs);

    const labelFilter = vscode.workspace.getConfiguration('openjdkDevel').get('labelFilter', '');
    if (labelFilter !== '') {
      const labelPRs = new PRsRootItem('PRs for ' + labelFilter, 'id-open-prs-labels',
        'is:open+is:pr+archived:false+label:rfr+org:openjdk+label:' + labelFilter,
        this);
      rootNodes.push(labelPRs);
    }

    const repoFilter: string = vscode.workspace.getConfiguration('openjdkDevel').get('repoFilter', '');
    if (repoFilter !== '') {
      repoFilter.split(',').forEach(repo => {
        const repoPRs = new PRsRootItem('PRs for ' + repo, 'id-open-prs-repo-' + repo,
          'is:open+is:pr+archived:false+label:rfr+repo:openjdk/' + repo,
          this);
        rootNodes.push(repoPRs);
      });
    }

    return rootNodes;
  }
}

abstract class GitHubTreeItem extends UpdatableTreeItem {
  children: GitHubTreeItem[] = [];
  constructor(label: string, readonly id: string, collapsibleState: vscode.TreeItemCollapsibleState,
    eagerExpand: boolean, icon: string,
    provider: UpdatableProvider, children?: GitHubTreeItem[]) {
    super(label, id, collapsibleState, eagerExpand, provider, children);
    this.iconPath = path.join(__filename, '..', '..', 'media', icon);
  }
}

class GitHubLeafTreeItem extends GitHubTreeItem {
  constructor(label: string, id: string, icon: string, targetUrl: string | undefined,
    provider: UpdatableProvider) {
    super(label, id, vscode.TreeItemCollapsibleState.None, false, icon, provider);
    if (targetUrl !== undefined) {
      this.command = {
        command: 'vscode.open',
        title: 'Open in Browser',
        arguments: [ vscode.Uri.parse(targetUrl) ]
      };
    }
  }

  protected loadChildrenArrayFromWeb(): Promise<GitHubTreeItem[]> {
    return Promise.resolve([]);
  }

  protected updateSelfAfterWebLoad(): void {
    // do nothing
  }
}

class AlertsRootItem extends GitHubTreeItem {
  constructor(label: string, provider: UpdatableProvider) {
    super(label, 'id', vscode.TreeItemCollapsibleState.Expanded, true,
      'github-notification.svg', provider);
    this.description = '...';
  }

  protected loadChildrenArrayFromWeb(): Promise<GitHubTreeItem[]> {
    return GitHubProvider.getGHjson(GitHubProvider.apiBase + 'notifications',
      (json: any, resolveJson: any, rejectJson: any) => {
        const newAlerts: AlertTreeItem[] = [];

        for (const alert of json) {
          if (alert.unread && alert.repository.owner.login === 'openjdk') {
            const notInfo = new AlertTreeItem(alert.subject.title, 'alert-' + alert.id,
              alert.subject.latest_comment_url, alert.subject.url, new Date(alert.updated_at),
              alert.repository.full_name, this.provider);
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
  prWebUrl: string;
  constructor(label: string, id: string, readonly commentUrl: string, readonly prUrl: string, readonly updatedAt: Date,
      readonly repository: string, provider: UpdatableProvider) {
    super(label, id, vscode.TreeItemCollapsibleState.Collapsed, false, 'github-item.svg', provider);
    // Technically we should look this up, but keep it simple and just rewrite URL
    this.prWebUrl = this.prUrl.replace(/https:\/\/api\.github\.com\/repos\/(.*\/.*)\/pulls\/(.*)/,
      'https://github.com/$1/pull/$2');
  }

  private fillInTimeStampAndPR(items: GitHubTreeItem[]) {
    const prNumber = this.prUrl.split('/').pop();

    let localeConf = vscode.workspace.getConfiguration('openjdkDevel').get('locale', '');
    let locale;
    if (localeConf === '') {
      locale = undefined;
    } else {
      locale = localeConf;
    }

    items.push(new GitHubLeafTreeItem(this.updatedAt.toLocaleString(locale),
      this.commentUrl + '+date', 'github-time.svg', this.prWebUrl, this.provider));

    items.push(new GitHubLeafTreeItem(`${this.repository}#${prNumber}`,
      this.commentUrl + '+pr', 'github-pullrequest.svg', this.prWebUrl, this.provider));
  }

  protected loadChildrenArrayFromWeb(): Promise<GitHubTreeItem[]> {
    const newCommentInfo: GitHubTreeItem[] = [];

    if (this.commentUrl !== null) {
      return GitHubProvider.getGHjson(this.commentUrl, (comment: any, resolveJson: any, rejectJson: any) => {
        // Stupid cleaning of html tags; will likely work ok since GitHub does the real work for us
        const cleanedComment = comment.body.replace(/<\/?[^>]+(>|$)/g, '').trim();

        const commentItem = new GitHubLeafTreeItem(cleanedComment.replace(/\s+/g, ' '),
          this.commentUrl + '+comment', 'github-conversation.svg', this.prWebUrl, this.provider);
        commentItem.tooltip = new vscode.MarkdownString(comment.body);
        newCommentInfo.push(commentItem);

        newCommentInfo.push(new GitHubLeafTreeItem(comment.user.login,
          this.commentUrl + '+username', 'github-user.svg', this.prWebUrl, this.provider));

        this.fillInTimeStampAndPR(newCommentInfo);

        resolveJson(newCommentInfo);
      });
    } else {
      this.fillInTimeStampAndPR(newCommentInfo);

      return Promise.resolve(newCommentInfo);
    }
  }

  protected updateSelfAfterWebLoad() {
    // do nothing
  }
}

class PRsRootItem extends GitHubTreeItem {
  constructor(label: string, id: string, readonly searchQuery: string,
    provider: UpdatableProvider) {
    super(label, id, vscode.TreeItemCollapsibleState.Expanded, true,
      'github-logo.svg', provider);
    this.description = '...';
  }

  protected loadChildrenArrayFromWeb(): Promise<GitHubTreeItem[]> {
    return GitHubProvider.getGHjson(GitHubProvider.apiBase +
      'search/issues?q=' + this.searchQuery,
    (json: any, resolveJson: any, rejectJson: any) => {
      const items = json.items;
      const newPRs: PRTreeItem[] = [];

      for (const item of items) {
        const tags = item.labels.map((label: any) => label.name).join(' ');
        const niceTitle = item.title.replace(/^[^0-9]+([0-9][0-9]+):? *(.*$)/, '$1: $2').trim();
        const description = item.body.replace(/^(.*)<!-- Anything below this marker will be .*$/s, '$1').trim();

        const jbsIssues: string[] = [];
        var issuesPart = /### Issues?\n \* .*\n### Review/s.exec(item.body);
        if (issuesPart) {
          const jbsPattern = /\* \[([A-Z]+-[0-9]+)\]\(.*bugs.openjdk.*\):/g;
          var match;

          while ((match = jbsPattern.exec(issuesPart[0]!)) !== null) {
            if (match[1]) {
              jbsIssues.push(match[1]);
            }
          }
        }

        const itemInfo = new PRTreeItem(niceTitle, this.id + '-' + item.id, item.html_url,
          item.repository_url.replace('https://api.github.com/repos/', ''),
          item.number, jbsIssues, tags, item.user.login, item.pull_request.url, description,
          this.provider);
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
  constructor(label: string, id: string, userReadableUrl: string, repo: string,
    prNumber: number, jbsIssues: string[], tags: string, author: string, readonly prUrl: string,
    description: string,
    provider: UpdatableProvider) {
    super(label, id, vscode.TreeItemCollapsibleState.Collapsed, false,
      'github-pullrequest.svg', provider);
    this.tooltip = `${label}\n${repo}#${prNumber} by @${author}`;

    const prUrlBase = `https://github.com/${repo}/pull/${prNumber}`;

    this.generated.push(new GitHubLeafTreeItem(`${repo}#${prNumber} by @${author}`, 'goto' + id,
      'github-overview.svg', prUrlBase, provider));

    const descItem = new GitHubLeafTreeItem(description.replace(/\s+/g, ' '), 'desc' + id,
      'github-conversation.svg', prUrlBase, provider);
    descItem.tooltip = new vscode.MarkdownString(description);
    this.generated.push(descItem);

    for (const jbsIssue of jbsIssues) {
      this.generated.push(new GitHubLeafTreeItem(jbsIssue, 'jbs' + id + '-' + jbsIssue,
        'github-bug.svg', 'https://bugs.openjdk.java.net/browse/' + jbsIssue, provider));
    }

    // Diff description must be complemented from prUrl, which can only be done later
    this.diffItem = new GitHubLeafTreeItem('Diff', 'diff' + id, 'github-diff.svg',
      prUrlBase + '/files', provider);
    this.generated.push(this.diffItem);

    if (tags) {
      this.generated.push(new GitHubLeafTreeItem(tags, 'tags' + id, 'github-tags.svg', prUrlBase,
        provider));

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
