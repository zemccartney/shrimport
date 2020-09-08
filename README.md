# shrimport

CLI for installing local packages 🦐 📦

A light wrapper around the technique described in ["How to Work with NPM Packages Locally Using .tgz Files"](https://rimdev.io/npm-packages-and-tgz-files/)


## Install

```sh
# Or use npx (see "Usage")
npm install -g shrimport
```

## Usage

```sh
## npx shrimport LOCAL [DEST]
npx shrimport ./my-pkg /path/to/dest
```

Installs `LOCAL` in `DEST` where:

- `LOCAL` - (required) path to a local package (should be in a publishable / testable state i.e. all desired changes made, build steps run, etc.)
- `DEST` - (optional) install destination; path to the package into which `LOCAL` will be installed. Defaults to `process.cwd()`

If all goes well, no further changes to `DEST` should be needed to run that module. Concretely, you shouldn't have to make any of the following changes, some or all of which might be required using other, symlink-based techniques for installing local packages e.g. `npm link`: 

- tweak build tool configs e.g. webpack plugins, that assume all dependencies resolve to within `node_modules` 
- change, then later undo, dependency semver ranges e.g. when changed to paths `file:../local-package`
- link peer dependencies from `DEST` back into `LOCAL`, as you [might have to do with React projects](https://github.com/facebook/react/issues/14257#issuecomment-439967377) (or other projects that assume only 1 instance of a given library)

<details>
<summary><strong>The Problem, in more detail</strong></summary>

You might want to incorporate an unpublished package or an unpublished version of
a package into a local environment. For example, running integration tests where you maintain both the local package and a project that depends on it; you want to make sure your project keeps working as expected with
the package's new version integrated

You likely want your local dependencies to behave exactly like "normal" dependencies i.e. packages specified via semver ranges in the destination package's `package.json` `dependencies`. Concretely, this means:
    
- node resolves your package to within the destination project's `node_modules`
- your package can reference only the artifacts it would have on file as if it were downloaded from the npm registry. It can't access its `devDependencies`

There are several methods that come close to checking these boxes:

- [`npm link`](https://docs.npmjs.com/cli/link)
- file path dependency in `package.json` e.g. `file:..package`
- `npm install ../path`

With these approaches, your destination project can `require()` your local package and might be able to start, but you're likely to eventually (if not immediately) see one or all of the following issues:

- since the local package is symlinked, it will be resolved outside `node_modules`, breaking assumptions often encoded in build tools like webpack e.g. excluding files found in `node_modules` from certain processing steps, which might error when run on your local package

- your local package will use its own dependencies (and likely `devDependencies`, which often include peerDependencies, given you're working on the project locally) if previously installed, an issue when working with frameworks that assume only 1 copy of the framework exists at runtime e.g. React. That is, both the local package and the destination would install a copy of the framework, triggering a conflict.

- if you delete the local package's `node_modules` to address the prior issue and if the local package specifies `peerDependencies`, which it requires in code i.e. expects to be resolvable from the project in which it's installed, you'll see module not found errors, as the local package will try to resolve its peers (and any required modules) from within itself, not the destination project (though this issue is potentially solvable by running the destionation via [`node --preserve symlinks`](https://nodejs.org/api/cli.html#cli_preserve_symlinks); your local package will be resolved within destination's `node_modules`, the location specified by the symlink)

The root of all of these issues is that the local package lives outside the destination; node's module resolution (as far as I can tell; woof, dependency management and resolution is hard! :) ) assumes a hierarchical relationship between dependents and dependencies. 

`shrimport` solves these issues by installing your local package in the destination's `node_modules` as if by running `npm install <pkg>`
 
</details>

### Options

- `-v, --version` output version and exit

- `-h, --help` output usage information and exit

## Caveats

- Because `shrimport` doesn't modify the destination's `package.json`, a fresh install of the destination project will overwrite your `shrimport` and will therefore necessitate re-`shrimport`ing

- `shrimport` is a small-scale crustacean. If you're working with an abundance of local packages, tools like [`yalc`](https://github.com/whitecolor/yalc) or [`lerna`](https://lerna.js.org/) are almost certainly far better fits. Though assume your mileage will vary!

