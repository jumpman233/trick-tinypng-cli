#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const fse = require('fs-extra')
const chalk = require('chalk')

const {detailLog} = require('./log')

const program = require('commander')

const defaultExts = ['.jpg', '.png']

const defaultParallel = 3

const {compressImage, compressImageInDir} = require('./tinyFunc')

const cmdResolve = async () => {
    const args = program.args.slice(0, program.args.length - 1)
    let parallel = Number(program.parallel)
    if (isNaN(parallel)) {
        console.error('warn: option -p, --parallel should be an integer, default 3 is used')
        parallel = defaultParallel
    }
    for (let i = 0; i < args.length; i++) {
        let resolvedPath = path.resolve(args[i])
        if (fse.pathExistsSync(resolvedPath)) {
            let stat = fs.lstatSync(resolvedPath)
            detailLog(chalk`{cyan \nstart to resolve path: ${resolvedPath}}`)
            if (stat.isDirectory()) {
                await compressImageInDir(resolvedPath, defaultExts, parallel, program.auto)
            } else {
                await compressImage(resolvedPath)
            }
            detailLog(chalk`{cyan resolve path end}`)
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
    .option('-a, --auto', 'auto retry failed files')
    .option('-l, --detaillog', 'more detailed log')
    .option('-d, --debuglog', 'debug level log')
    .action(cmdResolve)
    .parse(process.argv)
