const chalk = require('chalk')

const {detailLog, debugLog} = require('./log')

class CTime {
    constructor () {
        this.startTime = +new Date()
    }
    start () {
        this.startTime = +new Date()
    }
    end () {
        this.endTime = +new Date()
        return this.result(false)
    }
    result (log = true, warnTime = 1.5) {
        let result = (this.endTime - this.startTime) / 1000
        if (result > warnTime && log) {
            debugLog(chalk.red(`warn: cost time too long: ${result} s`))
        }
        return result
    }
    log () {
        console.log(`${(this.endTime - this.startTime) / 1000} s`)
    }
}

module.exports = CTime
