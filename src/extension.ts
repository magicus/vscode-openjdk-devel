import * as vscode from 'vscode';

import { GitHubProvider } from './github';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Loading extension "OpenJDK Development"');

  const githubProvider = new GitHubProvider();
  vscode.window.registerTreeDataProvider('gitHubIntegration', githubProvider);

  context.subscriptions.push(vscode.commands.registerCommand('openjdkDevel.gitHubIntegration.refresh', (url: any) => {
    githubProvider.userRefresh();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('openjdkDevel.setGithubToken', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'openjdkDevel.github.apiToken');
  }));

  vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('openjdkDevel.github.apiToken')) {
      githubProvider.userRefresh();
    }
  });
}

// this method is called when your extension is deactivated
export function deactivate() {
  // do nothing
}
