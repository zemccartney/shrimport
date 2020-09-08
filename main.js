'use strict'

const Bounce = require('@hapi/bounce')
const Execa = require('execa')
const Fs = require('fs').promises
const Joi = require('joi')
const Path = require('path')

exports.OpError = class extends Error {
  constructor (err, message) {
    super(`🦐📦 shrimport — Failed to install your local package!\n${message || err.message}`)
    this.name = 'OpError'
    this.original = err
  }
}

const internals = {}

internals.localTarballPath = (localPackagePath) => {
  const { name, version } = require(`${localPackagePath}/package.json`)
  return `${localPackagePath}/${name}-${version}.tgz`
}

exports.run = async (localPackage, dest) => {
  let localPackagePath
  let destPath
  const orcwd = process.cwd() // Save original process.cwd, revert back on success

  try {
    Joi.assert(localPackage, Joi.string().required().empty(['', null]), {
      messages: {
        'any.required': 'local package path is required!',
        'string.base': 'local package path must be a string'
      }
    })
    Joi.assert(dest, Joi.string().empty(['', null]), {
      messages: { 'string.base': 'destination path must be a string' }
    })

    localPackagePath = Path.resolve(localPackage)
    destPath = dest ? Path.resolve(dest) : process.cwd()

    await Promise.all([
      // We confirm the relevant package files exist to guarantee that npm
      // always runs relative to the user-specified package vs. traversing upwards
      // to a different package.json
      Fs.access(Path.join(localPackagePath, 'package.json')),
      Fs.access(Path.join(destPath, 'package.json'))
    ])

    // Due to the above access checks, the below commands _shouldn't_ fail
    // due to missing files or insufficient perms, leaving only errors
    // that, while I can't anticipate, probably/hopefully stem from the
    // state of the user's filesystem, not some silliness in this code
    process.chdir(localPackagePath)
    await Execa.command('npm pack --silent')
    process.chdir(destPath)
    await Execa.command(`npm install ${internals.localTarballPath(localPackagePath)} --no-save`)
    await Fs.unlink(internals.localTarballPath(localPackagePath))
  } catch (err) {
    Bounce.rethrow(err, 'system')

    // Wrap anticipated errors so later detectable for cleaner display

    if (err.code === 'ENOENT' && err.syscall === 'access') {
      const nonPkgSuffix = 'isn\'t a package (no package.json found)'
      let msg
      if (err.path === Path.join(localPackagePath, 'package.json')) {
        msg = `Local package at ${localPackagePath} ${nonPkgSuffix}`
      }
      if (err.path === Path.join(destPath, 'package.json')) {
        msg = `Destination package at ${destPath} ${nonPkgSuffix}`
      }
      throw new exports.OpError(err, msg)
    }

    if (err instanceof Joi.ValidationError) {
      throw new exports.OpError(err)
    }

    throw err // rethrow unanticipated errors
  } finally {
    // Likely unnecessary, I don't imagine this tool will be run in any
    // pipeline or sequence with other tooling, but just in case
    process.chdir(orcwd)
  }
}
