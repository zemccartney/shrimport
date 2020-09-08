'use strict'

const Arborist = require('@npmcli/arborist')
const Execa = require('execa')
const Shrimport = require('../../../index')
const Fs = require('fs').promises

const Path = require('path')


const hostPkg = `${__dirname}/host`
const localPkg = `${__dirname}/local-a`
const fakeRegistryPkg = `${__dirname}/remote-a`

function requireUncached(module) {
  delete require.cache[require.resolve(module)]
  return require(module)
}

const ab = new Arborist({
  path: './host'
})

/* ;(async () => {
  process.chdir(hostPkg)
  await Execa.command('npm install --no-progress --no-package-lock')
  process.chdir(fakeRegistryPkg)
  await Execa.command('npm install --no-progress --no-package-lock')

  console.log('DEUCE', host())

  await Shrimport(localPkg, hostPkg)
  // TODO Why doesn't this clear the cache? ...what do you expect to happen?
  // expect to print v2, but instead prints remote a dep info...why?
  delete require.cache[require.resolve(hostPkg)]

  let host2 = requireUncached(hostPkg)
  console.log('ANOOS', host2())
})()
*/

;(async () => {
  await Shrimport(localPkg, hostPkg)
  process.chdir(hostPkg)
  try {
    const { stdout } = await Execa.command('npm ls --json 2>&- | tee', { shell: true })
    console.log('CHAIN', stdout)
    const depPath = require(hostPkg)()
    console.log(depPath)
    console.log(Path.relative(depPath, `${__dirname}/host`))
    console.log(Path.normalize(depPath))
    const links = (await Execa.command('npm ls --link --json')).stdout.dependencies
    console.log(links)
  } catch (e) {
    console.log(e)
  }
})()
