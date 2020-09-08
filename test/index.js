const Code = require('@hapi/code')
const Execa = require('execa')
const Fs = require('fs').promises
const Lab = require('@hapi/lab')
const Path = require('path')
const Pkg = require('../package.json')

const { expect } = Code
// eslint-disable-next-line no-multi-assign
const { suite, test } = exports.lab = Lab.script()

const { run: Shrimport, OpError } = require('../main.js')

const internals = {}

internals.formatMsg = (message) => `🦐📦 shrimport — Failed to install your local package!\n${message}`

internals.patchFs = () => {
  const fsPatch = Fs.access
  Fs.access = () => {
    throw new Error('boom') // non-system error, so not rethrown
  }
  return () => {
    Fs.access = fsPatch
  }
}

internals.CLI = async (args) => {
  const bin = Path.join(__dirname, '..', Pkg.bin)
  const result = {
    code: 0,
    error: '',
    output: ''
  }
  try {
    const { exitCode, stdout } = await Execa(bin, args)
    result.output = stdout
    result.code = exitCode
  } catch (err) {
    result.error = err.stderr
    result.code = err.exitCode
  }

  return result
}

internals.helpMsg = () => (`
Usage: shrimport ../local/package/path [/dest/path]

Options:           

  -h, --help       Show help
  -v, --version    Show version
`).trim()

suite('Shrimport', () => {
  suite('programmatic interface', () => {
    test('fails if no local package path provided', async () => {
      const msg = internals.formatMsg('local package path is required!')
      await Promise.all([
        expect(Shrimport()).to.reject(OpError, msg),
        expect(Shrimport('')).to.reject(OpError, msg),
        expect(Shrimport(null)).to.reject(OpError, msg)
      ])
    })

    test('fails if invalid paths provided', async () => {
      const msg = (type) => internals.formatMsg(`${type} path must be a string`)
      await Promise.all([
        expect(Shrimport(5)).to.reject(OpError, msg('local package')),
        expect(Shrimport('string/path', 5)).to.reject(OpError, msg('destination'))
      ])
    })

    test('fails if specified paths don\'t lead to a package', async () => {
      const msg = (path, prefix) => internals.formatMsg(`${prefix} package at ${path} isn't a package (no package.json found)`)
      await expect(Shrimport('/completely/nonexistent/file/path')).to.reject(OpError, msg('/completely/nonexistent/file/path', 'Local'))
      await expect(Shrimport('.', '/completely/nonexistent/file/path')).to.reject(OpError, msg('/completely/nonexistent/file/path', 'Destination'))
      await expect(Shrimport('fixtures/not-pkg/local')).to.reject(OpError, msg(`${process.cwd()}/fixtures/not-pkg/local`, 'Local'))
      await expect(Shrimport('.', 'fixtures/not-pkg/dest')).to.reject(OpError, msg(`${process.cwd()}/fixtures/not-pkg/dest`, 'Destination'))
    })

    // perms error
    test('fails given insufficient permissions on any paths specified', async (flags) => {
      await Execa.command(`chmod 000 ${process.cwd()}/test/fixtures/perms`)
      flags.onCleanup = async () => {
        await Execa.command(`chmod 755 ${process.cwd()}/test/fixtures/perms`)
      }

      const msg = internals.formatMsg(`Local package at ${process.cwd()}/fixtures/perms isn't a package (no package.json found)`)
      await expect(Shrimport('./fixtures/perms')).to.reject(OpError, msg)
    })

    test('crashes on unexpected error', async (flags) => {
      flags.onCleanup = internals.patchFs()
      await expect(Shrimport(
        `${__dirname}/fixtures/happy-path/local-a`,
        `${__dirname}/fixtures/happy-path/dest`
      )).to.reject(Error, 'boom')
    })

    test('installs local package into destination module\'s node_modules as if normally intstalled', { timeout: 20000 }, async (flags) => {
      const destPkg = `${__dirname}/fixtures/happy-path/dest`
      const fakeRegistryPkg = `${__dirname}/fixtures/happy-path/remote-a`

      // All cases run in dest package dir
      process.chdir(destPkg)

      const cases = [
        { destPkg, localPkg: `${__dirname}/fixtures/happy-path/local-a` }, // absolute paths
        { destPkg: '.', localPkg: '../local-a' }, // relative paths (note cwd, per chdir above)
        { localPkg: `${__dirname}/fixtures/happy-path/local-a` } // dest package omitted (defaults to cwd)
      ]

      for (const test of cases) {
        await Execa.command('npm install --no-progress --no-package-lock')

        const originalTree = JSON.parse((await Execa.command('npm ls --json')).stdout)
        expect(originalTree.dependencies.a.version).to.equal(require(`${fakeRegistryPkg}/package.json`).version)

        // Initial state of dest package e.g. existing node_modules folder, shouldn't matter to Shrimport
        // In all cases, Shrimport will run an install, creating node_modules first as needed, then installing
        // the specified localPackage, replacing any installed version of the package
        await Shrimport(test.localPkg, test.destPkg)

        // workaround npm ls erroring in this case: to npm, our shrimported dep is invalid,
        // since it's a version different from the one specified in package.json
        // 2>&- turns off stderr from npm ls, so only stdout is redirected
        // tee just reads from stdout and passes it on, but also prevents the pipeline
        // from ending with a 1 exit code (causing execa to throw)
        // https://stackoverflow.com/questions/549737/how-can-i-redirect-stderr-to-stdout-but-ignore-the-original-stdout
        const postShrimportTree = JSON.parse((await Execa.command('npm ls --json 2>&- | tee', { shell: true })).stdout)
        // dest has the local version of our package installed
        expect(postShrimportTree.dependencies.a.version).to.equal(require(`${Path.resolve(test.localPkg)}/package.json`).version)

        // installed module resolves dependencies from the dests
        const isPkgUsingHostDep = new RegExp(`^${destPkg}/node_modules/.+$`).test(require(destPkg)())
        expect(isPkgUsingHostDep).to.be.true()

        // our local package is installed on file, not symlinked in
        const linkedDeps = JSON.parse((await Execa.command('npm ls --link --json')).stdout).dependencies
        expect(linkedDeps).to.be.undefined()

        await Execa.command('rm -rf node_modules')
      }
    })
  })

  suite('CLI', () => {
    test('prints help if invalid options provided', async () => {
      const result = await internals.CLI(['-Z'])
      expect(result.code).to.equal(1)
      expect(result.output).to.equal('')
      expect(result.error).to.equal(`${internals.helpMsg()}\n\nUnknown option: Z`)
    })

    test('prints version if version flag provided', async () => {
      const result = await internals.CLI(['-v'])
      expect(result.code).to.equal(0)
      expect(result.output).to.equal(Pkg.version)
    })

    test('prints help if help flag provided', async () => {
      const result = await internals.CLI(['-h'])
      expect(result.code).to.equal(0)
      expect(result.output).to.equal(internals.helpMsg())
    })

    test('installs local package into dest module\'s node_modules as if normally intstalled', { timeout: 5000 }, async () => {
      const localPkg = `${__dirname}/fixtures/happy-path/local-a`
      const dest = `${__dirname}/fixtures/happy-path/dest`
      const result = await internals.CLI([
        localPkg,
        dest
      ])
      expect(result.code).to.equal(0)
      expect(result.output).to.equal(`🦐📦 shrimport success! 🎩🍾 ${localPkg} is now installed in ${dest}!`)
    })

    test('prints error message on invalid input', async () => {
      const result = await internals.CLI([
        '/completely/nonexistent/file/path'
      ])
      expect(result.code).to.equal(1)
      expect(result.output).to.equal('')
      expect(result.error).to.equal(
        internals.formatMsg(
          'Local package at /completely/nonexistent/file/path isn\'t a package (no package.json found)'
        )
      )
    })
  })
})
