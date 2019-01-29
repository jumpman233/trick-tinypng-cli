const axios = require('axios')
const fs = require('fs')
const path = require('path')
const fse = require('fs-extra')
const chalk = require('chalk')
const klawSync = require('klaw-sync')

class ComporessInfo {
    constructor (path, inputSize, outputSize) {
        this.path = path
        this.inputSize = inputSize
        this.outputSize = outputSize
        this.caculate()
    }
    caculate () {
        this.compressSize = this.inputSize - this.outputSize
        this.compressRatio = ((this.compressSize / this.inputSize) * 100).toFixed(2)
    }
    log () {
        let fileName = path.parse(this.path).base
        console.log(`fileName: ${chalk.blue(fileName)}
inputSize: ${chalk.green(this.getKB(this.inputSize))}
outputSize: ${chalk.green(this.getKB(this.outputSize))}
compressSize: ${chalk.yellow(this.getKB(this.compressSize))}
compressRatio: ${chalk.yellow(this.compressRatio + ' %')}`)
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
    console.log(imgPath)
    imgPath = path.resolve(imgPath)
    const imgData = fs.readFileSync(imgPath)
    const imgName = path.parse(imgPath).base
    const imgExt = path.parse(imgPath).ext
    contentType = extContentTypeMap[imgExt]

    try {
        const res = await axios.post('https://tinypng.com/web/shrink', imgData, {
            headers: {
                'referer': 'https://tinypng.com/',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
                'origin': 'https://tinypng.com',
                'content-type': contentType
            }
        })
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
        const res = await axios.get(imgUrl, {
            responseType: 'arraybuffer'
        })
        fs.writeFileSync('/Users/lzh-finup/Pictures/ps_images/xjsc_201801/images/zxxxxx_13_heh.jpg', res.data)
        return res.data
    } catch (err) {
        throw new Error(err)
    }
}

// save image data to target path
const writeImage = async (imageData, targetPath) => {
    try {
        targetPath = path.resolve(targetPath)
        const targetDir = path.parse(targetPath).dir
        await fse.ensureDir(targetDir)
        fs.writeFileSync(targetPath, imageData)   
    } catch(e) {
        throw new Error(e)
    }
}

// compress a image and save it to target path
const compressImage = async (imgPath, targetPath, log = false) => {
    try {
        let imgData = await uploadImage(imgPath)
        let imgUrl = imgData.output.imgUrl
        let imgBuffer = await getImageBuffer(imgUrl)
        writeImage(imgBuffer, targetPath)
        let compressInfo = new ComporessInfo(imgPath, imgData.input.size, imgData.output.size)
        log && compressInfo.log()
        return compressInfo
    } catch (e) {
        console.error(`compressImage failed! imgPath: ${imgPath, targetPath}`)
        throw new Error(e)
    }
}

const comporessImageList = async (imgList, exts = ['.png', '.jpg'], parallel = 2) => {
    const errorList = []
    const files = klawSync(dirPath)
    let compressCount = 0
    let totalInputSize = 0
    let totalOutputSize = 0
    let index = 0
    const resolveOneImage = async (imgPath) => {
        try {
            const compressInfo = await compressImage(imgPath, imgPath)
            compressInfo.log()
            throw new Error("??")
        } catch (e) {
            console.error(e)
            errorList.push(imgPath)
        }
    }
    console.log(chalk.blue(`image counts: ${imgList.length}, parallelNum: ${parallel}`))
    while (index < imgList.length) {
        let tempImages = []
        let tempIndex = 0
        while (tempIndex < parallel && tempIndex < imgList.length) {
            tempImages.push(imgList[index])
            tempIndex++
            index++
            totalInputSize += imgList[index]
        }
        try {
            
        } catch (e) {
            await Promise.all(tempImages.map(image => resolveOneImage(image.path)))
        }
    }
    return errorList
}

const compressImageInDir = async (dirPath, exts = ['.png', '.jpg'], parallel = 2) => {
    const files = klawSync(dirPath)
    let compressCount = 0
    let totalInputSize = 0
    let totalOutputSize = 0
    let images = files.filter(file => exts.includes(path.parse(file.path).ext))
    let index = 0
    while (images.length > 0) {
        images = await comporessImageList(images, exts, parallel)
        console.log(images)
    }
}

const filePath = '/Users/lzh-finup/Pictures/ps_images/xjsc_201801/images/card-bk_19.png'

const targetPath = '/Users/lzh-finup/Pictures/ps_images/xjsc_201801/images/card-bk_192.png'

const dirPath = '/Users/lzh-finup/Pictures/ps_images/xjsc_201801/images_back'

// compressImage(filePath, targetPath)
compressImageInDir(dirPath)
