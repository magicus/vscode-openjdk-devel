# OpenJDK Development Support Extension

This is a Visual Studio Code extension that provides support OpenJDK
development. The primary audience is active developers in OpenJDK projects.

The extension provides integration with OpenJDK projects on GitHub, and with
the JDK Bug System (JBS).

The intention is to keep adding functionality that is relevant to OpenJDK
developers. If you have any ideas or suggestions, please let me know!

![Screenshot](media/screenshot.png)

## Extension Settings

This extension contributes the following settings:

* `openjdkDevel.github.username`: GitHub user name needed for GitHub integration
* `openjdkDevel.github.apiToken`: GitHub API token needed for GitHub integration
* `openjdkDevel.jbs.username`: JBS user name needed for JBS integration
* `openjdkDevel.jbs.apiToken`: JBS API token needed for JBS integration
* `openjdkDevel.jbs.filters`: Comma-separated list of JBS filter IDs to show
* `openjdkDevel.labelFilter`: Comma-separated list of labels to show Pull Requests for
* `openjdkDevel.repoFilter`: Comma-separated list of OpenJDK repos to show Pull Requests for
* `openjdkDevel.locale`: override locale for formatting of e.g. dates

## Extension Commands

This extension contributes the following commands:

* `openjdkDevel.gitHubIntegration.refresh`: Refresh GitHub Integration
* `openjdkDevel.jbsIntegration.refresh`: Refresh JBS Integration
* `openjdkDevel.setGithubToken`: Setup GitHub API Token
* `openjdkDevel.setGithubUsername`: Setup GitHub username
* `openjdkDevel.setJbsToken`: Setup JBS API Token
* `openjdkDevel.setJbsUsername`: Setup JBS username
* `openjdkDevel.setFilter`: Setup PR filter

## Attributions

* The Duke icon is based on an original from https://wiki.openjdk.java.net/display/duke/Main (License: New BSD)
* Icons from Octicons https://primer.style/octicons/ (License: MIT)
* Icons from Codicons https://microsoft.github.io/vscode-codicons/ (Licence: CC BY 4.0)
* Icons from Iconoir https://iconoir.com/ (Licence: MIT)

## Release Notes

### 2.0.3

Maintainance release to fix documentation.

### 2.0.2

Add ability to open the PR diff as an editor in VS Code. I highly recommend
complementing this functionality with a plugin for viewing diff files, such as
[Diff Viewer](https://marketplace.visualstudio.com/items?itemName=caponetto.vscode-diff-viewer).

### 2.0.1

Added "Collapse all" button to tree views.

### 2.0.0

Added JBS integration.

Fixed problem with multiple JBS links in PRs.

### 1.1.0

Added support for "repo" filters as well as "label" filters.

### 1.0.0

Initial release. This includes basic GitHub integration.
