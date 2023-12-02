import * as path from 'path';
import * as vscode from 'vscode';

import { UpdatableProvider, UpdatableTreeItem } from './updatable';
import fetch from 'node-fetch';


export class JbsProvider extends UpdatableProvider<JbsTreeItem> {
  private static apiToken: string = '';
  public static apiBase: string = 'https://bugs.openjdk.org/rest/api/2/';

  public static getJBSjson(url: string, processJson: (json: any, resolveJson: any, rejectJson: any) => void) {
    JbsProvider.apiToken = vscode.workspace.getConfiguration('openjdkDevel').get('jbs.apiToken', '');
    if (JbsProvider.apiToken === '') {
      return Promise.reject(new Error('No JBS API Token set'));
    }

    return new Promise<JbsTreeItem[]>((resolve, reject) => fetch(url, {
      /* eslint-disable @typescript-eslint/naming-convention */
      headers: {
        'Authorization': 'Bearer ' + JbsProvider.apiToken,
        'User-Agent': 'vscode-openjdk-devel'
      }
      /* eslint-enable @typescript-eslint/naming-convention */
    })
      .then(res => res.json())
      .then(json => {
        processJson(json, resolve, reject);
      })
      .catch((error: any) => {
        reject(new Error('JBS Integration error: ' + error));
      }));
  }

  protected verifySettings(): boolean {
    const token = vscode.workspace.getConfiguration('openjdkDevel').get('jbs.apiToken', '');
    const username = vscode.workspace.getConfiguration('openjdkDevel').get('jbs.username', '');
    return token !== '' && username !== '';
  }

  protected setupTree(): JbsTreeItem[] {
    const rootNodes: JbsTreeItem[] = [];

    const username = vscode.workspace.getConfiguration('openjdkDevel').get('jbs.username', '');
    const myIssues = new IssuesRootItem('My open issues', 'issues-mine', 'jql=assignee%3D' + username
      + '%20and%20resolution%3Dunresolved%20order%20by%20updated%20desc', this.onDidChangeTreeDataEmitter);
    rootNodes.push(myIssues);

    const jbsFilter: string = vscode.workspace.getConfiguration('openjdkDevel').get('jbs.filters', '');

    if (jbsFilter !== '') {
      jbsFilter.split(',').forEach(filter => {
        const filterIssues = new FilterIssuesRootItem(filter, this.onDidChangeTreeDataEmitter);
        rootNodes.push(filterIssues);
      });
    }

    return rootNodes;
  }
}

abstract class JbsTreeItem extends UpdatableTreeItem<JbsTreeItem> {
  children: JbsTreeItem[] = [];
  constructor(label: string, readonly id: string, collapsibleState: vscode.TreeItemCollapsibleState,
    eagerExpand: boolean, icon: string,
    onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>, children?: JbsTreeItem[]) {
    super(label, id, collapsibleState, eagerExpand, onDidChangeTreeDataEmitter, children);
    this.iconPath = path.join(__filename, '..', '..', 'media', icon);
  }
}

class JbsLeafTreeItem extends JbsTreeItem {
  constructor(label: string, id: string, icon: string, targetUrl: string | undefined,
    onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>) {
    super(label, id, vscode.TreeItemCollapsibleState.None, false, icon, onDidChangeTreeDataEmitter);
    if (targetUrl !== undefined) {
      this.command = {
        command: 'vscode.open',
        title: 'Open in Browser',
        arguments: [vscode.Uri.parse(targetUrl)]
      };
    }
  }

  protected loadChildrenArrayFromWeb(): Promise<JbsTreeItem[]> {
    return Promise.resolve([]);
  }

  protected updateSelfAfterWebLoad(): void {
    // do nothing
  }
}

class IssuesRootItem extends JbsTreeItem {
  constructor(label: string, id: string, readonly searchQuery: string,
    onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>) {
    super(label, id, vscode.TreeItemCollapsibleState.Expanded, true,
      'jbs-search.svg', onDidChangeTreeDataEmitter);
    this.description = '...';
  }

  protected loadChildrenArrayFromWeb(): Promise<JbsTreeItem[]> {
    return JbsProvider.getJBSjson(JbsProvider.apiBase + 'search?' + this.searchQuery,
      (json: any, resolveJson: any, rejectJson: any) => {
        const newIssues: IssueTreeItem[] = [];

        for (const issue of json.issues) {
          let component;
          if (issue.fields.components.length > 0) {
            component = issue.fields.components[0].name;
          } else {
            // In OpenJDK, we require a component, so this should never happen
            component = null;
          }

          let subcomponent;
          if (issue.fields.customfield_10008) {
            subcomponent = issue.fields.customfield_10008.name;
          } else {
            subcomponent = null;
          }

          let assignee;
          let assigneeFullName;
          if (issue.fields.assignee) {
            assignee = issue.fields.assignee.name;
            assigneeFullName = issue.fields.assignee.displayName;
          } else {
            assignee = null;
            assigneeFullName = null;
          }

          let fixVersion;
          var fixVersionsArray = issue.fields.fixVersions;
          if (fixVersionsArray.length > 0) {
            fixVersion = fixVersionsArray.length > 0 ? fixVersionsArray[0].name : '';
          } else {
            fixVersion = null;
          }

          const updated = new Date(issue.fields.updated);

          const issueItem = new IssueTreeItem(issue.key, 'issue-' + this.id + '-' + issue.id, issue.self,
            issue.fields.summary, issue.fields.status.name, issue.fields.issuetype.name, issue.fields.priority.name,
            component, subcomponent, issue.fields.description, updated, issue.fields.labels, assignee, assigneeFullName,
            fixVersion, this.onDidChangeTreeDataEmitter);
          newIssues.push(issueItem);
        }
        resolveJson(newIssues);
      });
  }

  protected updateSelfAfterWebLoad() {
    this.description = this.children ? this.children.length + ' issues' : 'No issues';
  }
}

class FilterIssuesRootItem extends IssuesRootItem {
  constructor(readonly filterId: string,
    onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>) {
    super('Issues for filter ' + filterId, 'issue-filter-' + filterId,
      'jql=filter=' + filterId, onDidChangeTreeDataEmitter);
  }

  protected loadChildrenArrayFromWeb(): Promise<JbsTreeItem[]> {
    // Update our label
    JbsProvider.getJBSjson(JbsProvider.apiBase + 'filter/' + this.filterId,
      (json: any, resolveJson: any, rejectJson: any) => {
        var label = json.name;
        this.label = label;
      });

    return super.loadChildrenArrayFromWeb();
  }
}

class IssueTreeItem extends JbsTreeItem {
  webUrl: string = '';

  constructor(key: string, readonly issueId: string, readonly apiUrl: string,
    readonly summary: string, readonly status: string, readonly type: string,
    readonly prio: string, readonly component: string, readonly subcomponent: string | null, readonly desc: string,

    readonly updatedAt: Date,
    readonly labels: string[],
    readonly assignee: string, readonly assigneeFullName: string,
    readonly fixVersion: string | null,
    onDidChangeTreeDataEmitter: vscode.EventEmitter<vscode.TreeItem | undefined>) {
    super(key + ': ' + summary, issueId, vscode.TreeItemCollapsibleState.Collapsed, false,
      getStatusIcon(), onDidChangeTreeDataEmitter);
    this.webUrl = 'https://bugs.openjdk.org/browse/' + key;

    function getStatusIcon(): string {
      if (status === 'New') {
        return 'jbs-new.svg';
      } else if (status === 'Closed' || status === 'Resolved' || status === 'Completed' || status === 'Integrated') {
        return 'jbs-closed.svg';
      } else {
        return 'jbs-open.svg';
      }
    }
  }

  private populateIssue(items: JbsTreeItem[]) {
    const localeConf = vscode.workspace.getConfiguration('openjdkDevel').get('locale', '');
    let locale;
    if (localeConf === '') {
      locale = undefined;
    } else {
      locale = localeConf;
    }

    let typeIcon;
    if (this.type === 'Enhancement') {
      typeIcon = 'jbs-enhancement.svg';
    } else if (this.type === 'Task' || this.type === 'Sub-task') {
      typeIcon = 'jbs-task.svg';
    } else if (this.type === 'Backport') {
      typeIcon = 'jbs-backport.svg';
    } else {
      typeIcon = 'jbs-bug.svg';
    }

    items.push(new JbsLeafTreeItem(`${this.prio} ${this.type} - ${this.status}`,
      this.issueId + '+info', typeIcon, this.webUrl, this.onDidChangeTreeDataEmitter));

    if (this.desc) {
      items.push(new JbsLeafTreeItem(this.desc,
        this.issueId + '+desc', 'jbs-description.svg', this.webUrl, this.onDidChangeTreeDataEmitter));
    }

    items.push(new JbsLeafTreeItem(this.component + (this.subcomponent ? '/' + this.subcomponent : ''),
      this.issueId + '+component', 'github-overview.svg', this.webUrl, this.onDidChangeTreeDataEmitter));

    if (this.labels.length > 0) {
      items.push(new JbsLeafTreeItem(this.labels.join(' '),
        this.issueId + '+tags', 'github-tags.svg', this.webUrl, this.onDidChangeTreeDataEmitter));
    }

    if (this.assignee) {
      items.push(new JbsLeafTreeItem('@' + this.assignee + ' (' + this.assigneeFullName + ')',
        this.issueId + '+assignee', 'github-user.svg', this.webUrl, this.onDidChangeTreeDataEmitter));
    }

    if (this.fixVersion) {
      items.push(new JbsLeafTreeItem(this.fixVersion,
        this.issueId + '+fixVersion', 'jbs-target.svg', this.webUrl, this.onDidChangeTreeDataEmitter));
    }

    items.push(new JbsLeafTreeItem(this.updatedAt.toLocaleString(locale),
      this.issueId + '+date', 'github-time.svg', this.webUrl, this.onDidChangeTreeDataEmitter));
  }

  protected loadChildrenArrayFromWeb(): Promise<JbsTreeItem[]> {
    const newIssueInfo: JbsTreeItem[] = [];

    this.populateIssue(newIssueInfo);

    // Add latest comment
    const commentPromise = JbsProvider.getJBSjson(this.apiUrl + '/comment?orderBy=-created&maxResults=0',
      (json: any, resolveJson: any, rejectJson: any) => {
        const commentItems: JbsTreeItem[] = [];

        if (json.comments.length > 0) {
          const commentAuthor = json.comments[0].author.name;
          const commentId = json.comments[0].id;
          const comment = json.comments[0].body;
          const commentUrl = this.webUrl + '?focusedId=' + commentId +
            '&page=com.atlassian.jira.plugin.system.issuetabpanels%3Acomment-tabpanel#comment-' + commentId;

          const commentItem = new JbsLeafTreeItem('@' + commentAuthor + ': ' + comment,
            this.issueId + '+comment', 'github-conversation.svg', commentUrl,
            this.onDidChangeTreeDataEmitter);
          commentItems.push(commentItem);
        }

        resolveJson(commentItems);
      });

    const reviewPromise = JbsProvider.getJBSjson(this.apiUrl + '/remotelink',
      (json: any, resolveJson: any, rejectJson: any) => {
        const reviewItems: JbsTreeItem[] = [];

        for (const link of json) {
          if (link.object.title === 'Review') {
            const reviewUrl = link.object.url;
            // transform from e.g. openjdk/jdk/4711 to openjdk/jdk#4711
            const summary = link.object.summary.replace(/\/([^\/]+)$/, '#$1');

            const reviewItem = new JbsLeafTreeItem(summary,
              this.issueId + '+review-' + summary, 'github-pullrequest.svg', reviewUrl,
              this.onDidChangeTreeDataEmitter);
            reviewItems.push(reviewItem);
          }
        }

        resolveJson(reviewItems);
      });

    // This dance is needed to keep the items in the same order all the time
    return Promise.all([commentPromise, reviewPromise]).then(input => {
      const commentInfo = input[0];
      const reviewInfo = input[1];

      newIssueInfo.push(...commentInfo);
      newIssueInfo.push(...reviewInfo);
      return newIssueInfo;
    });
  }

  protected updateSelfAfterWebLoad() {
    // do nothing
  }
}
