# Systems

* [exp-spsh web application](exp-spsh-app.md) - The deployed artifact itself - what is built, where it runs, and the runtime assumptions it makes about the browser.
* [Google Sheets and Identity (the backend)](google-workspace.md) - The external system that stores all application data and authenticates users, plus the console configuration it requires.
* [GitHub Actions and GitHub Pages](github-pages.md) - The build-and-host system - what triggers a deployment, how secrets become keys.json, and the URL contract Pages imposes.
* [Development toolchain](toolchain.md) - Pinned framework and tooling versions, the builders behind each npm script, and the local platform assumptions.

# Related

* [Operations](../operations/) - how to build, test, and deploy against these systems.
* [Interfaces](../interfaces/) - the wire-level contracts with each external system.
