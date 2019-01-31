const axios = require('axios')
const fs = require('fs')
const path = require('path')
const fse = require('fs-extra')
const chalk = require('chalk')
const klawSync = require('klaw-sync')

const {detailLog, debugLog} = require('./log')

const instance = axios.create({
    timeout: 10000
})

const CTime = require('./CTime')

const CompressInfo = require('./CompressInfo')

const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout))

const inquirer = require('inquirer')
const ora = require('ora')

// upload a image to get a compressed image url
const uploadImage = async (imgPath) => {
    const extContentTypeMap = {
        '.png': 'image/png',
        '.jpg': 'image/jpg'
    }
    imgPath = path.resolve(imgPath)
    const imgData = fs.readFileSync(imgPath)
    const imgName = path.parse(imgPath).base
    const imgExt = path.parse(imgPath).ext
    const contentType = extContentTypeMap[imgExt]

    try {
        let time = new CTime()
        debugLog(`\nsend getImageUrl request ${imgName}`)
        const res = await instance.post('https://tinypng.com/web/shrink', imgData, {
            headers: {
                'referer': 'https://tinypng.com/',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
                'origin': 'https://tinypng.com',
                'content-type': contentType
            }
        })
        time.end()
        debugLog(`\nget getImageUrl response ${imgName}, cost: ${time.result()} s`)
        res.data.output.imgUrl = res.data.output.url + '/' + encodeURIComponent(imgName)
        return res.data
    } catch (err) {
        throw err
    }
}

// get image buffer by request a url
const getImageBuffer = async (imgUrl) => {
    try {
        let time = new CTime()
        debugLog(`\nsend getImageBuffer request ${imgUrl}`)
        const res = await instance.get(imgUrl, {
            responseType: 'arraybuffer'
        })
        time.end()
        debugLog(`\nget getImageBuffer response ${imgUrl}, cost: ${time.result()} s`)
        return res.data
    } catch (err) {
        throw err
    }
}

// save image data to target path
const writeImage = async (imageData, targetPath) => {
    let time = new CTime()
    debugLog(`\nwrite image start ${targetPath}`)
    try {
        targetPath = path.resolve(targetPath)
        const targetDir = path.parse(targetPath).dir
        await fse.ensureDir(targetDir)
        fs.writeFileSync(targetPath, imageData)
    } catch(e) {
        throw e
    }
    time.end()
    debugLog(`\nwrite image end ${targetPath}, cost: ${time.result()} s`)
}

// compress a image and save it to target path
const compressImage = async (imgPath, targetPath) => {
    if (!targetPath) {
        targetPath = imgPath
    }
    try {
        let imgData = await uploadImage(imgPath)
        let imgUrl = imgData.output.imgUrl
        let imgBuffer = await getImageBuffer(imgUrl)
        writeImage(imgBuffer, targetPath)
        let compressInfo = new CompressInfo(imgPath, imgData.input.size, imgData.output.size)
        detailLog(chalk`\n{yellow path: ${imgPath}}`)
        detailLog(compressInfo.info())
        return compressInfo
    } catch (e) {
        // log && console.error(`compressImage failed! imgPath: ${imgPath}, ${targetPath}`)
        throw e
    }
}

const compressImageList = async (
    imgList,
    parallel = 2,
    interval = 4000
) => {
    const errorList = []
    let totalInputSize = 0
    let totalOutputSize = 0
    let index = 0
    let resolveCount = 0
    let error = ''
    let curLength = 0
    const resolveOneImage = async (imgPath, index, total) => {
        const consoleTitle = () => {
            resolveCount++
            detailLog(chalk`{blue [${resolveCount}/${total}]:}`)
            detailLog(chalk`{yellow path: ${imgPath}}`)
        }
        let compressInfo = null
        try {
            compressInfo = await compressImage(imgPath)
            consoleTitle()
            detailLog(compressInfo.info())
        } catch (e) {
            consoleTitle()
            console.error(chalk`{red \ncompress failed!}`)
            console.error(chalk`\t{red path: ${imgPath}}`)
            console.error(chalk`\t{red error message: ${e.message || e}}`)
            debugLog(e.stack)
            errorList.push(imgList[index])
        }
        return compressInfo
    }
    while (index < imgList.length) {
        let tempImages = []
        let tempIndex = 0
        while (tempIndex < parallel && index < imgList.length) {
            tempImages.push(imgList[index])
            imgList[index].index = index
            tempIndex++
            index++
            curLength++
        }
        let startIndex = index - tempImages.length + 1
        const spinner = ora(`compressing ${startIndex}-${index}[${imgList.length}]`).start()
        await Promise.all(tempImages.map(async (image) => {
            let compressInfo = await resolveOneImage(image.path, image.index, imgList.length)
            if (compressInfo instanceof CompressInfo) {
                totalInputSize += compressInfo.inputSize
                totalOutputSize += compressInfo.outputSize
            }
        }))
        await delay(interval)
        spinner.stop()
    }
    return {
        errorList,
        compressInfo: new CompressInfo(null, totalInputSize, totalOutputSize)
    }
}

const compressImageInDir = async (
    dirPath,
    exts = ['.png', '.jpg'],
    parallel = 2,
    isAutoContinue = false,
    interval = 4000
) => {
    const checkContinue = async (isAuto) => {
        if (isAuto) {
            console.error(chalk`{blue auto retry compress}`)
            return true
        }
        const {confirmRetry} = await inquirer.prompt({
            type: 'confirm',
            name: 'confirmRetry',
            message: `above images compress failed, retry?`
        })
        return confirmRetry
    }

    const files = klawSync(dirPath)

    console.log(chalk`{yellow parallel compress number:} {green ${parallel}}`)
    console.log(chalk`{yellow isAutoContinue:} {green ${isAutoContinue}}`)
    console.log(chalk`{yellow interval:} {green ${interval}}`)
    console.log()

    let images = files.filter(file => exts.includes(path.parse(file.path).ext))
    while (images.length > 0) {
        console.log(chalk`{blue compress started}`)
        let result = await compressImageList(images, parallel, interval)
        let unresolvedImages = result.errorList
        let successNum = images.length - unresolvedImages.length
        let failNum = result.errorList.length

        console.log(chalk`{blue compress finished}`)
        console.log(chalk`{green summary:}`)
        console.log(chalk`\t{green success: ${successNum}}`)
        console.log(chalk`\t{red failed: ${failNum}}`)
        console.log(result.compressInfo.info())

        images = unresolvedImages
        if (unresolvedImages.length > 0) {
            console.error(chalk.red('----------failed images---------'))
            unresolvedImages.forEach(image => console.error(chalk.red(image.path)))
            console.error(chalk.red('----------failed images end---------'))
            let isContinue = await checkContinue(isAutoContinue)
            if (!isContinue) {
                break
            }
        } else {
            break
        }
    }
}

module.exports = {
    uploadImage,
    getImageBuffer,
    writeImage,
    compressImage,
    compressImageInDir,
    compressImageList
}
