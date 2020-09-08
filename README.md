# shrimport

CLI for installing local packages 🦐 📦

A light wrapper around the technique described in ["How to Work with NPM Packages Locally Using .tgz Files"](https://rimdev.io/npm-packages-and-tgz-files/) by [Jaime Jones](https://github.com/jaime-lynn)


## Install

```sh
# Or use npx (see "Usage")
npm install -g shrimport
```

## Usage

Given,

- a local package, in a publishable state e.g. changes made, build steps run, etc.
- a second package, or the destination, that uses some version of the local package as a dependency

```sh
## npx shrimport LOCAL [DEST]
npx shrimport ./my-pkg /path/to/dest
```

- `LOCAL` - (required) path to a local package
- `DEST` - (optional) install destination; path to the package into which `LOCAL` will be installed. Defaults to `process.cwd()`

If all goes well, `LOCAL` will be installed in `DEST`, no further changes needed to run that module. Concretely, you shouldn't have to make any of the following changes, some or all of which might be required using other, symlink-based techniques for installing local packages e.g. `npm link`: 

- tweak build tool configs e.g. webpack plugins, that assume all dependencies resolve to within `node_modules` 
- change, then later undo, dependency semver ranges e.g. when changed to paths `file:../local-package`
- link peer dependencies from `DEST` back into `LOCAL`, as you [might have to do with React projects](https://github.com/facebook/react/issues/14257#issuecomment-439967377) (or other projects that assume only 1 instance of a given library)

<details>
<summary><em>The Problem, in more detail</em></summary>

You might want to incorporate an unpublished package or an unpublished version of
a package into a local environment. For example, running integration tests where you maintain both the local package and a project that depends on it; you want to make sure your project keeps working as expected with
the package's new version integrated

You likely want your local dependencies to behave exactly like "normal" dependencies i.e. packages specified via semver ranges in a `package.json`'s `dependencies`. Concretely, this means:
    
- node resolves your package to within the destination project's `node_modules` folder
- your package can reference only the artifacts it would have on file as if it were downloaded from the npm registry. Specifically, it can't access its `devDependencies`

There are several methods that come close to checking these boxes:

- [`npm link`](https://docs.npmjs.com/cli/link)
- file path dependency in `package.json` e.g. `file:..package`
- `npm install ../path` 
- Running the destination module via `node --preserve-symlinks` (https://nodejs.org/api/cli.html#cli_preserve_symlinks)

With these approaches, your destination project can `require()` your local package and might be able to start, but you're likely to hit eventually (if not immediately) see one or all of the following issues:

- since the local package is symlinked, it will be resolved outside `node_modules`, breaking assumptions often encoded in build tools like webpack e.g. excluding files found in `node_modules` from certain processing steps, which might error when run on your local package

- your local package will use its own dependencies, likely included devDependencies, which often include peerDependencies, if previously installed, notably an issue when working with React projects, where its assumed you only have exactly 1 copy of the React library; React crashes when 2 copies are found at runtime

- if you delete the local package's `node_modules` to address the prior issue and if the local package specifies `peerDependencies`, which it requires in code i.e. expects to be resolvable from the project in which it's installed, you'll see module not found errors, as the local package will try to resolve its peers from within itself, not the destination project (though this issue is potentially solvable by running the destionation with `node --preserve symlinks` flag; your local package will be resolved within destination's `node_modules`, the location specified by the symlink)

The root of all of these issues is that the local package lives outside the destination; node's module resolution (as far as I can tell; woof, dependency management and resolution is hard! :) ) assume a hierarchical relationship between dependees and dependencies. 

`shrimport` solves these issues by installing your local package in the destination's `node_modules` as if by running `npm install <pkg>`
 
</details>

### Options

- `-v, --version` output version and exit

- `-h, --help` output usage information and exit

## Caveats

- Because shrimport doesn't modify the destination's `package.json`, a fresh install of the destination project will overwrite your shrimport and will therefore necessitate re-shrimporting

- `shrimport` is a small-scale crustacean. If you're working with an abundance of local packages, tools like [`yalc`](https://github.com/whitecolor/yalc) or [`lerna`](https://lerna.js.org/) are almost certainly far better fits. Though assume your mileage will vary!

