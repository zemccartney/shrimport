#!/usr/bin/env node

'use strict'

const Bossy = require('@hapi/bossy')
const Bounce = require('@hapi/bounce')

const Main = require('./main')
const Pkg = require('./package.json')

const definition = {
  h: {
    alias: 'help',
    description: 'Show help',
    type: 'help'
  },
  v: {
    alias: 'version',
    description: 'Show version',
    type: 'boolean'
  }
}

const argv = Bossy.parse(definition)

if (argv instanceof Error) {
  console.error(Bossy.usage(definition, 'shrimport ../local/package/path [/dest/path]'))
  console.error(`\n${argv.message}`)
  process.exit(1)
}

if (argv.help) {
  console.log(Bossy.usage(definition, 'shrimport ../local/package/path [/dest/path]'))
  process.exit(0)
}

if (argv.version) {
  console.log(Pkg.version)
  process.exit(0)
}

const [localPackage, dest] = argv._

const run = async () => {
  try {
    await Main.run(localPackage, dest)
    console.log(`🦐📦 shrimport success! 🎩🍾 ${localPackage} is now installed in ${dest || process.cwd()}!`)
    process.exit(0)
  } catch (err) {
    /* c8 ignore next */
    // TODO Find a way to test a non-operational error reaching here
    // Issue was that any monkeypatching in tests didn't apply in childprocess
    // in which bin is spawned
    Bounce.ignore(err, Main.OpError)
    console.error(err.message)
    process.exit(1)
  }
}

run()
