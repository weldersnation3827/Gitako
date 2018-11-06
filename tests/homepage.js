const { launch } = require('./launch')

launch().then(async browser => {
  const page = await browser.newPage()
  await page.goto('https://github.com')
})
