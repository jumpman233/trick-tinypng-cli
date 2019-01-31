# trick-tinypng-cli

Compress images in command lines. Free, and convenient.

## install
```
npm install -g trick-tinypng-cli
```

## Usage
```
tiny ./imgdir
tiny ./img/test.png
tiny ./imgdir1 ./imgdir2 ./img/test1.png ...
```
```
$ tiny -h
Usage: tiny [options] <file ...>

Options:
  -v, --version           output the version number
  -p, --parallel [value]  parallel numbers of downloading images, use as '-p 3' (default: 3)
  -a, --auto              auto retry failed files
  -l, --detaillog         more detailed log
  -d, --debuglog          debug level log
  -i, --interval [value]  the interval between two requests group, use as '-i 1000' (default: 4000)
  -h, --help              output usage information
```

## License
MIT