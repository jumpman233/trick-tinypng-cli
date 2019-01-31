const test = require('ava')
const {compressImageInDir, compressImage} = require('./src/tinyFunc')

process.env.CI = 1

test('compress in dir', async t => {
    await compressImageInDir('./img')
    t.pass()
})

test('compress one image', async t => {
    await compressImage('./img/img1.png')
    t.pass()
})
