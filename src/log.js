const program = require('commander')

const debugLog = (...args) => {
    program.debuglog && console.log.apply(null, args)
}

const detailLog = (...args) => {
    program.detaillog && console.log.apply(null, args)
}

module.exports = {
    debugLog,
    detailLog
}
