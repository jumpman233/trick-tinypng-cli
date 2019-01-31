const chalk = require('chalk')

class CompressInfo {
    constructor (path, inputSize, outputSize) {
        this.path = path
        this.inputSize = inputSize
        this.outputSize = outputSize
        this.calculate()
    }
    calculate () {
        this.compressSize = this.inputSize - this.outputSize
        this.compressRatio = ((this.compressSize / this.inputSize) * 100).toFixed(2) || 0
    }
    info () {
        return (chalk`\t{yellow inputSize: ${this.getKB(this.inputSize)}}
\t{yellow outputSize: ${this.getKB(this.outputSize)}}
\t{yellow compressSize:} {green ${(this.getKB(this.compressSize))}}
\t{yellow compressRatio:} {green ${this.compressRatio} %}
`)
    }
    getKB (str) {
        return `${str / 1000} KB`
    }
}

module.exports = CompressInfo
