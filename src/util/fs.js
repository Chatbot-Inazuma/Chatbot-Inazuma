const fs = require('fs-extra');
const path = require('path');
const CSON = require("cson");

const logger = require("./logger")("lib/fs");

function isDir(source){
  return fs.lstatSync(source).isDirectory();
}

function getDirList(source){
  return fs.readdirSync(source).map(function(name){
      return path.join(source, name);
    }).filter(isDir);
}

function readCSONFile(cson){
  try{
    fs.accessSync(cson, fs.R_OK|fs.W_OK);
    logger.info(`Successfully read ${cson}`);
    return CSON.parseCSONFile(cson);
  }
  catch(e){
    logger.error(`Fail to read cson from ${cson}`);
    logger.error(e);
    return undefined;
  }
}

module.exports = {
  isDir,
  getDirList,
  readCSONFile
};
