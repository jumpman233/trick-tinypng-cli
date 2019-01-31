const program = require('commander')

const debugLog = (...args) => {
    program.debuglog && console.log(args)
}

const detailLog = (...args) => {
    program.detaillog && console.log(args)
}

module.exports = {
    debugLog,
    detailLog
}
