const puppeteer = require('puppeteer')
const path = require('path')

const CRX_PATH = path.resolve(__dirname, '../dist')

exports.launch = (options) =>
  puppeteer.launch({
    headless: false, // required for extensions
    args: [`--disable-extensions-except=${CRX_PATH}`, `--load-extension=${CRX_PATH}`],
    ...options
  })

exports.getGitako = () => window.GITAKO_DEBUG_INTERFACE
