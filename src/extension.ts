import * as vscode from 'vscode';

import { GitHubProvider } from './github';
import { JbsProvider } from './jbs';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  console.log('Loading extension "OpenJDK Development"');

  const githubProvider = new GitHubProvider();
  vscode.window.createTreeView('gitHubIntegration', {
    treeDataProvider: githubProvider,
    showCollapseAll: true
  });
  setInterval(() => githubProvider.userRefresh(), 5 * 60 * 1000); // 5 minutes

  context.subscriptions.push(vscode.commands.registerCommand('openjdkDevel.gitHubIntegration.refresh', (url: any) => {
    githubProvider.userRefresh();
  }));

  const jbsProvider = new JbsProvider();
  vscode.window.createTreeView('jbsIntegration', {
    treeDataProvider: jbsProvider,
    showCollapseAll: true
  });
  setInterval(() => jbsProvider.userRefresh(), 5 * 60 * 1000); // 5 minutes

  context.subscriptions.push(vscode.commands.registerCommand('openjdkDevel.jbsIntegration.refresh', (url: any) => {
    jbsProvider.userRefresh();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('openjdkDevel.setGithubToken', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'openjdkDevel.github.apiToken');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('openjdkDevel.setGithubUsername', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'openjdkDevel.github.username');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('openjdkDevel.setFilter', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'openjdkDevel');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('openjdkDevel.setJbsUsername', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'openjdkDevel.jbs.username');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('openjdkDevel.setJbsToken', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'openjdkDevel.jbs.apiToken');
  }));

  vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('openjdkDevel.github.apiToken')) {
      githubProvider.userRefresh();
    }
    if (event.affectsConfiguration('openjdkDevel.github.username')) {
      githubProvider.userRefresh();
    }
    if (event.affectsConfiguration('openjdkDevel.labelFilter')) {
      // Needs to force reload if label filter is changed
      githubProvider.userRefresh(true);
    }
    if (event.affectsConfiguration('openjdkDevel.repoFilter')) {
      // Needs to force reload if repo filter is changed
      githubProvider.userRefresh(true);
    }
    if (event.affectsConfiguration('openjdkDevel.jbs.username')) {
      jbsProvider.userRefresh();
    }
    if (event.affectsConfiguration('openjdkDevel.jbs.apiToken')) {
      jbsProvider.userRefresh();
    }
    if (event.affectsConfiguration('openjdkDevel.jbs.filters')) {
      // Needs to force reload if JBS filters are changed
      jbsProvider.userRefresh(true);
    }
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
  // do nothing
}
