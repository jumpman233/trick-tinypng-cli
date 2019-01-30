#!/usr/bin/env node

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const fse = require('fs-extra')
const chalk = require('chalk')
const klawSync = require('klaw-sync')

const program = require('commander')
const inquirer = require('inquirer')
const ora = require('ora')

const defaultExts = ['.jpg', '.png']

const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout))

const instance = axios.create({
    timeout: 10000
})

class CTime {
    constructor () {
        this.startTime = +new Date()
    }
    start () {
        this.startTime = +new Date()   
    }
    end () {
        this.endTime = +new Date()
    }
    result (warnTime = 1.5) {
        let result = (this.endTime - this.startTime) / 1000
        if (result > warnTime) {
            console.log(chalk.red(`warn: cost time too long: ${result} s`))
        }
        return result
    }
    log () {
        console.log(`${(this.endTime - this.startTime) / 1000} s`)
    }
}

class CompressInfo {
    constructor (path, inputSize, outputSize) {
        this.path = path
        this.inputSize = inputSize
        this.outputSize = outputSize
        this.caculate()
    }
    caculate () {
        this.compressSize = this.inputSize - this.outputSize
        this.compressRatio = ((this.compressSize / this.inputSize) * 100).toFixed(2) || 0
    }
    log () {
        // let fileName = path.parse(this.path).base
        // fileName: ${chalk.blue(fileName)}
        console.log(chalk`    {yellow inputSize: ${this.getKB(this.inputSize)}}
    {yellow outputSize: ${this.getKB(this.outputSize)}}
    {yellow compressSize:} {green ${(this.getKB(this.compressSize))}}
    {yellow compressRatio:} {green ${this.compressRatio} %}
`)
    }
    getKB (str) {
        return `${str / 1000} KB`
    }
}

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
        program.debuglog && console.log(`\nsend getImageUrl request ${imgName}`)
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
        program.debuglog && console.log(`\nget getImageUrl response ${imgName}, cost: ${time.result()} s`)
        res.data.output.imgUrl = res.data.output.url + '/' + encodeURIComponent(imgName)
        return res.data
    } catch (err) {
        throw new Error(err)
        console.error(err.response.data)
    }
}

// get image buffer by request a url
const getImageBuffer = async (imgUrl) => {
    try {
        let time = new CTime()
        program.debuglog && console.log(`\nsend getImageBuffer request ${imgUrl}`)
        const res = await instance.get(imgUrl, {
            responseType: 'arraybuffer'
        })
        time.end()
        program.debuglog && console.log(`\nget getImageBuffer response ${imgUrl}, cost: ${time.result()} s`)
        return res.data
    } catch (err) {
        throw new Error(err)
    }
}

// save image data to target path
const writeImage = async (imageData, targetPath) => {
    let time = new CTime()
    program.debuglog && console.log(`\nwrite image start ${targetPath}`)
    try {
        targetPath = path.resolve(targetPath)
        const targetDir = path.parse(targetPath).dir
        await fse.ensureDir(targetDir)
        fs.writeFileSync(targetPath, imageData)   
    } catch(e) {
        throw new Error(e)
    }
    time.end()
    program.debuglog && console.log(`\nwrite image end ${targetPath}, cost: ${time.result()} s`)
}

// compress a image and save it to target path
const compressImage = async (imgPath, targetPath, log = false) => {
    try {
        let imgData = await uploadImage(imgPath)
        let imgUrl = imgData.output.imgUrl
        let imgBuffer = await getImageBuffer(imgUrl)
        writeImage(imgBuffer, targetPath)
        let compressInfo = new CompressInfo(imgPath, imgData.input.size, imgData.output.size)
        log && console.log(chalk`{yellow path: ${imgPath}}`)
        log && compressInfo.log()
        return compressInfo
    } catch (e) {
        log && console.error(`compressImage failed! imgPath: ${imgPath}, ${targetPath}`)
        throw new Error(e)
    }
}

const compressImageList = async (imgList, exts = ['.png', '.jpg'], parallel = 2) => {
    const errorList = []
    let totalInputSize = 0
    let totalOutputSize = 0
    let index = 0
    let resolveCount = 0
    let error = ''
    const resolveOneImage = async (imgPath, index, total) => {
        let compressInfo = null
        try {
            if (index === 3) {
                throw new Error("test error")
            }
            compressInfo = await compressImage(imgPath, imgPath)
        } catch (e) {
            error = e
            errorList.push(imgList[index])
        } finally {
            resolveCount++
            program.log && console.log(chalk`
{blue [${resolveCount}/${total}]:}
{yellow path: ${imgPath}}`)
            if (compressInfo) {
                program.log && compressInfo.log()
            } else {
                console.log(chalk`    \n{red compress failed!
    ${error}}\n`)
            }
        }
        return compressInfo
    }
    console.log(chalk`{blue compress started}
    {yellow image counts: ${imgList.length}}
    {yellow parallel compress number: ${parallel}}`)
    while (index < imgList.length) {
        let tempImages = []
        let tempIndex = 0
        while (tempIndex < parallel && index < imgList.length) {
            tempImages.push(imgList[index])
            imgList[index].index = index
            tempIndex++
            index++
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
        spinner.stop()
    }
    return {
        errorList,
        compressInfo: new CompressInfo(null, totalInputSize, totalOutputSize)
    }
}

const compressImageInDir = async (dirPath, exts = ['.png', '.jpg'], parallel = 2) => {
    const files = klawSync(dirPath)
    let images = files.filter(file => exts.includes(path.parse(file.path).ext))
    while (images.length > 0) {
        let originLength = images.length
        let result = await compressImageList(images, exts, parallel)
        images = result.errorList
        let successNum = originLength - result.errorList.length
        let failNum = result.errorList.length
        console.log(chalk`
{blue compress finished}
{green summary:}
    {green success: ${successNum}}
    {red failed: ${failNum}}`)
        result.compressInfo.log()
        if (images.length > 0) {
            images.forEach(image => {
                console.log(chalk.red(image.path))
            })
            if (program.auto) {
                console.log(chalk`{blue auto retry compress}`)
                continue
            }
            const {confirmRetry} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirmRetry',
                message: `above images compress failed, retry?`
            })
            if (!confirmRetry) {
                break
            }
        }
        delay(300)
    }
}

const defaultParallel = 3

const cmdResolve = async () => {
    const args = program.args.slice(0, program.args.length - 1)
    console.log(program.parallel)
    let parallel = Number(program.parallel)
    if (isNaN(parallel)) {
        console.error('warn: option -p, --parallel should be an integer, default 3 is used')
        parallel = defaultParallel
    }
    for (let i = 0; i < args.length; i++) {
        let resolvedPath = path.resolve(args[i])
        if (fse.pathExistsSync(resolvedPath)) {
            let stat = fs.lstatSync(resolvedPath)
            console.log(chalk`{cyan \nstart to resolve path: ${resolvedPath}}`)
            if (stat.isDirectory()) {
                await compressImageInDir(resolvedPath, defaultExts, parallel)
            } else {
                await compressImage(resolvedPath, resolvedPath, true)
            }
            console.log(chalk`{cyan resolve path end}`)
        } else {
            console.error(`input path doesn't exists: ${resolvedPath}`)
            process.exit(1)
        }
    }
}

program
    .version('0.1.0', '-v, --version')
    .usage('[options] <file ...>')
    .option('-p, --parallel [value]', 'parallel numbers of downloading images, use as \'-p 3\'', defaultParallel)
    .option('-a --auto', 'auto retry failed files')
    .option('-l, --log', 'more detailed log')
    .option('-d, --debuglog', 'debug level log')
    .action(cmdResolve)
    .parse(process.argv)

