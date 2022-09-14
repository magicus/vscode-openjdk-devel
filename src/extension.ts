import * as vscode from 'vscode';

import { GitHubProvider } from './github';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  console.log('Loading extension "OpenJDK Development"');

  const githubProvider = new GitHubProvider();
  vscode.window.registerTreeDataProvider('gitHubIntegration', githubProvider);
  setInterval(() => githubProvider.userRefresh(), 5 * 60 * 1000); // 5 minutes

  context.subscriptions.push(vscode.commands.registerCommand('openjdkDevel.gitHubIntegration.refresh', (url: any) => {
    githubProvider.userRefresh();
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
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
  // do nothing
}
