"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cleanup = cleanup;
exports.filepath = filepath;
exports.dir = dir;
exports.file = file;

var _fs = _interopRequireDefault(require("fs"));

var _os = _interopRequireDefault(require("os"));

var _path = _interopRequireDefault(require("path"));

var _cryptoRandomString = _interopRequireDefault(require("crypto-random-string"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// constants
var EMPTY_STRING = '';
var DEFAULT_DIR_MODE = 0o777;
var DEFAULT_ENCODING = 'utf8';
var DEFAULT_FILE_MODE = 0o666;
var DEFAULT_NAME = 'temporarily-{WWWWDDDD}';
var TMP_DIR = 'temporarily-{XXXXXXXX}';
var DIGIT = '1234567890';
var WORD = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
var TEMPLATE_INTERPOLATE = /\{([^}]+)\}/g; // utils

var sample = function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}; // private


var templateChars = {
  /* eslint-disable id-length */
  d: function d() {
    return sample(DIGIT);
  },
  w: function w() {
    return sample(WORD);
  },
  x: function x() {
    return (0, _cryptoRandomString.default)(1);
  }
  /* eslint-enable id-length */

};
var tempXCallbacks = []; // const debug = (...args) => {
//   console.log(...args);
// };

var moveTo = function moveTo(toTempDir) {
  var move = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  return function (fromTemp) {
    /* eslint-disable no-param-reassign */
    var newFilepath = _path.default.join(toTempDir.filepath, _path.default.basename(fromTemp.filepath));

    if (move) {
      _fs.default.renameSync(fromTemp.filepath, newFilepath); // debug('MOVED', fromTemp.filepath, newFilepath);

    }

    fromTemp.filepath = newFilepath;

    if (fromTemp.children) {
      fromTemp.children = fromTemp.children.map(moveTo(fromTemp, false));
    }

    return fromTemp;
  };
};

var templateReplacer = function templateReplacer(match, innerMatch) {
  return innerMatch.split(EMPTY_STRING).map(function (char) {
    var chars = templateChars[char.toLowerCase()];

    if (!chars) {
      throw new Error(`Expected template placeholder to be one of: ${Object.keys(templateChars).join(', ')}. Received ${char}`);
    }

    return chars();
  }).join(EMPTY_STRING);
};

var tmpDir = function tmpDir() {
  return _path.default.join(_os.default.tmpdir(), TMP_DIR.replace(TEMPLATE_INTERPOLATE, templateReplacer));
}; // exports


function registerCleanup(fn) {
  tempXCallbacks.push(fn);
  return function manualCleanupOne() {
    fn();
    tempXCallbacks = tempXCallbacks.filter(function (callback) {
      return callback !== fn;
    });
  };
}
/** */


function cleanup() {
  tempXCallbacks.forEach(function (fn) {
    fn();
  });
  tempXCallbacks.length = 0;
}
/**
 * @param {object} [options]
 * @param {string} [options.dir=os.tmpdir]
 * @param {string} [options.ext]
 * @param {string} [options.name=temporarily-{WWWWDDDD}]
 * @return {string} filepath
 */


function filepath() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$dir = _ref.dir,
      dirPath = _ref$dir === void 0 ? tmpDir() : _ref$dir,
      _ref$ext = _ref.ext,
      ext = _ref$ext === void 0 ? null : _ref$ext,
      _ref$name = _ref.name,
      name = _ref$name === void 0 ? DEFAULT_NAME : _ref$name;

  var dirname = _path.default.resolve(dirPath);

  var basename = name.replace(TEMPLATE_INTERPOLATE, templateReplacer);
  return _path.default.join(dirname, `${basename}${ext ? `.${ext}` : ''}`);
}
/**
 * @param {object}        [options]
 * @param {number}        [options.mode=0o777]
 * @param {Array<object>} [children]
 * @return {object} dir props
 */


function dir() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var children = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  if (Array.isArray(options)) {
    /* eslint-disable no-param-reassign */
    children = options;
    options = {};
    /* eslint-enable no-param-reassign */
  }

  var _options = options,
      _options$mode = _options.mode,
      mode = _options$mode === void 0 ? DEFAULT_DIR_MODE : _options$mode;
  var tempDir = {
    filepath: filepath(options),
    isDir: true,
    mode
  };

  try {
    _fs.default.accessSync(tempDir.filepath, _fs.default.F_OK);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error(`Could not check ${tempDir.filepath}.`);
    }

    tempDir.cleanup = registerCleanup(function () {
      _fs.default.rmdirSync(tempDir.filepath);
    });

    var parentDir = _path.default.dirname(tempDir.filepath);

    dir({
      dir: _path.default.dirname(parentDir),
      name: _path.default.basename(parentDir)
    });

    _fs.default.mkdirSync(tempDir.filepath, mode); // debug('CREATED DIR', tempDir.filepath);

  }

  if (children.length !== 0) {
    tempDir.children = children.map(moveTo(tempDir));
  }

  return tempDir;
}
/**
 * @param {object} [options]
 * @param {string} [options.data='']
 * @param {string} [options.encoding=utf8]
 * @param {number} [options.mode=0o666]
 * @return {object} file props
 */


function file() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var _options$data = options.data,
      data = _options$data === void 0 ? '' : _options$data,
      _options$encoding = options.encoding,
      encoding = _options$encoding === void 0 ? DEFAULT_ENCODING : _options$encoding,
      _options$mode2 = options.mode,
      mode = _options$mode2 === void 0 ? DEFAULT_FILE_MODE : _options$mode2;
  var tempFile = {
    data,
    filepath: filepath(options),
    isFile: true,
    mode
  };

  var parentDir = _path.default.dirname(tempFile.filepath);

  tempFile.cleanup = registerCleanup(function () {
    _fs.default.unlinkSync(tempFile.filepath);
  });

  try {
    _fs.default.accessSync(parentDir, _fs.default.F_OK);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error(`Could not check ${parentDir}.`);
    }

    dir({
      dir: _path.default.dirname(parentDir),
      name: _path.default.basename(parentDir)
    });
  }

  _fs.default.writeFileSync(tempFile.filepath, data, {
    encoding,
    mode
  }); // debug('CREATED FILE', tempFile.filepath);


  return tempFile;
} // auto clean up


process.on('exit', cleanup);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL2xpYi9pbmRleC5qcyJdLCJuYW1lcyI6WyJFTVBUWV9TVFJJTkciLCJERUZBVUxUX0RJUl9NT0RFIiwiREVGQVVMVF9FTkNPRElORyIsIkRFRkFVTFRfRklMRV9NT0RFIiwiREVGQVVMVF9OQU1FIiwiVE1QX0RJUiIsIkRJR0lUIiwiV09SRCIsIlRFTVBMQVRFX0lOVEVSUE9MQVRFIiwic2FtcGxlIiwiYXJyYXkiLCJNYXRoIiwiZmxvb3IiLCJyYW5kb20iLCJsZW5ndGgiLCJ0ZW1wbGF0ZUNoYXJzIiwiZCIsInciLCJ4IiwidGVtcFhDYWxsYmFja3MiLCJtb3ZlVG8iLCJ0b1RlbXBEaXIiLCJtb3ZlIiwiZnJvbVRlbXAiLCJuZXdGaWxlcGF0aCIsInBhdGgiLCJqb2luIiwiZmlsZXBhdGgiLCJiYXNlbmFtZSIsImZzIiwicmVuYW1lU3luYyIsImNoaWxkcmVuIiwibWFwIiwidGVtcGxhdGVSZXBsYWNlciIsIm1hdGNoIiwiaW5uZXJNYXRjaCIsInNwbGl0IiwiY2hhciIsImNoYXJzIiwidG9Mb3dlckNhc2UiLCJFcnJvciIsIk9iamVjdCIsImtleXMiLCJ0bXBEaXIiLCJvcyIsInRtcGRpciIsInJlcGxhY2UiLCJyZWdpc3RlckNsZWFudXAiLCJmbiIsInB1c2giLCJtYW51YWxDbGVhbnVwT25lIiwiZmlsdGVyIiwiY2FsbGJhY2siLCJjbGVhbnVwIiwiZm9yRWFjaCIsImRpciIsImRpclBhdGgiLCJleHQiLCJuYW1lIiwiZGlybmFtZSIsInJlc29sdmUiLCJvcHRpb25zIiwiQXJyYXkiLCJpc0FycmF5IiwibW9kZSIsInRlbXBEaXIiLCJpc0RpciIsImFjY2Vzc1N5bmMiLCJGX09LIiwiZXJyIiwiY29kZSIsInJtZGlyU3luYyIsInBhcmVudERpciIsIm1rZGlyU3luYyIsImZpbGUiLCJkYXRhIiwiZW5jb2RpbmciLCJ0ZW1wRmlsZSIsImlzRmlsZSIsInVubGlua1N5bmMiLCJ3cml0ZUZpbGVTeW5jIiwicHJvY2VzcyIsIm9uIl0sIm1hcHBpbmdz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dUMsSUFBNUI7QUFDRCxHQUZELENBRUUsT0FBT0MsR0FBUCxFQUFZO0FBQ1osUUFBSUEsR0FBRyxDQUFDQyxJQUFKLEtBQWEsUUFBakIsRUFBMkI7QUFDekIsWUFBTSxJQUFJOUIsS0FBSixDQUFXLG1CQUFrQmdDLFNBQVUsR0FBdkMsQ0FBTjtBQUNEOztBQUNEakIsSUFBQUEsR0FBRyxDQUFDO0FBQ0ZBLE1BQUFBLEdBQUcsRUFBRTlCLGNBQUtrQyxPQUFMLENBQWFhLFNBQWIsQ0FESDtBQUVGZCxNQUFBQSxJQUFJLEVBQUVqQyxjQUFLRyxRQUFMLENBQWM0QyxTQUFkO0FBRkosS0FBRCxDQUFIO0FBSUQ7O0FBQ0QzQyxjQUFHbUQsYUFBSCxDQUFpQkgsUUFBUSxDQUFDbEQsUUFBMUIsRUFBb0NnRCxJQUFwQyxFQUEwQztBQUFFQyxJQUFBQSxRQUFGO0FBQVlaLElBQUFBO0FBQVosR0FBMUMsRUEzQmlDLENBNEJqQzs7O0FBQ0EsU0FBT2EsUUFBUDtBQUNELEMsQ0FFRDs7O0FBRUFJLE9BQU8sQ0FBQ0MsRUFBUixDQUFXLE1BQVgsRUFBbUI3QixPQUFuQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmltcG9ydCByYW5kb21TdHJpbmcgZnJvbSAnY3J5cHRvLXJhbmRvbS1zdHJpbmcnO1xuXG4vLyBjb25zdGFudHNcblxuY29uc3QgRU1QVFlfU1RSSU5HID0gJyc7XG5cbmNvbnN0IERFRkFVTFRfRElSX01PREUgPSAwbzc3NztcbmNvbnN0IERFRkFVTFRfRU5DT0RJTkcgPSAndXRmOCc7XG5jb25zdCBERUZBVUxUX0ZJTEVfTU9ERSA9IDBvNjY2O1xuY29uc3QgREVGQVVMVF9OQU1FID0gJ3RlbXBvcmFyaWx5LXtXV1dXRERERH0nO1xuY29uc3QgVE1QX0RJUiA9ICd0ZW1wb3JhcmlseS17WFhYWFhYWFh9JztcblxuY29uc3QgRElHSVQgPSAnMTIzNDU2Nzg5MCc7XG5jb25zdCBXT1JEID0gJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVonO1xuXG5jb25zdCBURU1QTEFURV9JTlRFUlBPTEFURSA9IC9cXHsoW159XSspXFx9L2c7XG5cbi8vIHV0aWxzXG5cbmNvbnN0IHNhbXBsZSA9IChhcnJheSkgPT4gYXJyYXlbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogYXJyYXkubGVuZ3RoKV07XG5cbi8vIHByaXZhdGVcblxuY29uc3QgdGVtcGxhdGVDaGFycyA9IHtcbiAgLyogZXNsaW50LWRpc2FibGUgaWQtbGVuZ3RoICovXG4gIGQ6ICgpID0+IHNhbXBsZShESUdJVCksXG4gIHc6ICgpID0+IHNhbXBsZShXT1JEKSxcbiAgeDogKCkgPT4gcmFuZG9tU3RyaW5nKDEpLFxuICAvKiBlc2xpbnQtZW5hYmxlIGlkLWxlbmd0aCAqL1xufTtcblxubGV0IHRlbXBYQ2FsbGJhY2tzID0gW107XG5cbi8vIGNvbnN0IGRlYnVnID0gKC4uLmFyZ3MpID0+IHtcbi8vICAgY29uc29sZS5sb2coLi4uYXJncyk7XG4vLyB9O1xuXG5jb25zdCBtb3ZlVG8gPSAodG9UZW1wRGlyLCBtb3ZlID0gdHJ1ZSkgPT4gKGZyb21UZW1wKSA9PiB7XG4gIC8qIGVzbGludC1kaXNhYmxlIG5vLXBhcmFtLXJlYXNzaWduICovXG4gIGNvbnN0IG5ld0ZpbGVwYXRoID0gcGF0aC5qb2luKFxuICAgIHRvVGVtcERpci5maWxlcGF0aCxcbiAgICBwYXRoLmJhc2VuYW1lKGZyb21UZW1wLmZpbGVwYXRoKSxcbiAgKTtcbiAgaWYgKG1vdmUpIHtcbiAgICBmcy5yZW5hbWVTeW5jKGZyb21UZW1wLmZpbGVwYXRoLCBuZXdGaWxlcGF0aCk7XG4gICAgLy8gZGVidWcoJ01PVkVEJywgZnJvbVRlbXAuZmlsZXBhdGgsIG5ld0ZpbGVwYXRoKTtcbiAgfVxuICBmcm9tVGVtcC5maWxlcGF0aCA9IG5ld0ZpbGVwYXRoO1xuICBpZiAoZnJvbVRlbXAuY2hpbGRyZW4pIHtcbiAgICBmcm9tVGVtcC5jaGlsZHJlbiA9IGZyb21UZW1wLmNoaWxkcmVuLm1hcChtb3ZlVG8oZnJvbVRlbXAsIGZhbHNlKSk7XG4gIH1cbiAgcmV0dXJuIGZyb21UZW1wO1xufTtcblxuY29uc3QgdGVtcGxhdGVSZXBsYWNlciA9IChtYXRjaCwgaW5uZXJNYXRjaCkgPT5cbiAgaW5uZXJNYXRjaFxuICAgIC5zcGxpdChFTVBUWV9TVFJJTkcpXG4gICAgLm1hcCgoY2hhcikgPT4ge1xuICAgICAgY29uc3QgY2hhcnMgPSB0ZW1wbGF0ZUNoYXJzW2NoYXIudG9Mb3dlckNhc2UoKV07XG4gICAgICBpZiAoIWNoYXJzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgRXhwZWN0ZWQgdGVtcGxhdGUgcGxhY2Vob2xkZXIgdG8gYmUgb25lIG9mOiAke09iamVjdC5rZXlzKFxuICAgICAgICAgICAgdGVtcGxhdGVDaGFycyxcbiAgICAgICAgICApLmpvaW4oJywgJyl9LiBSZWNlaXZlZCAke2NoYXJ9YCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjaGFycygpO1xuICAgIH0pXG4gICAgLmpvaW4oRU1QVFlfU1RSSU5HKTtcblxuY29uc3QgdG1wRGlyID0gKCkgPT4gcGF0aC5qb2luKG9zLnRtcGRpcigpLCBUTVBfRElSLnJlcGxhY2UoVEVNUExBVEVfSU5URVJQT0xBVEUsIHRlbXBsYXRlUmVwbGFjZXIpKTtcblxuLy8gZXhwb3J0c1xuXG5mdW5jdGlvbiByZWdpc3RlckNsZWFudXAoZm4pIHtcbiAgdGVtcFhDYWxsYmFja3MucHVzaChmbik7XG4gIHJldHVybiBmdW5jdGlvbiBtYW51YWxDbGVhbnVwT25lKCkge1xuICAgIGZuKCk7XG4gICAgdGVtcFhDYWxsYmFja3MgPSB0ZW1wWENhbGxiYWNrcy5maWx0ZXIoKGNhbGxiYWNrKSA9PiBjYWxsYmFjayAhPT0gZm4pO1xuICB9XG59XG5cbi8qKiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gIHRlbXBYQ2FsbGJhY2tzLmZvckVhY2goKGZuKSA9PiB7XG4gICAgZm4oKTtcbiAgfSk7XG4gIHRlbXBYQ2FsbGJhY2tzLmxlbmd0aCA9IDA7XG59XG5cbi8qKlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRpcj1vcy50bXBkaXJdXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZXh0XVxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLm5hbWU9dGVtcG9yYXJpbHkte1dXV1dEREREfV1cbiAqIEByZXR1cm4ge3N0cmluZ30gZmlsZXBhdGhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbGVwYXRoKHtcbiAgZGlyOiBkaXJQYXRoID0gdG1wRGlyKCksXG4gIGV4dCA9IG51bGwsXG4gIG5hbWUgPSBERUZBVUxUX05BTUUsXG59ID0ge30pIHtcbiAgY29uc3QgZGlybmFtZSA9IHBhdGgucmVzb2x2ZShkaXJQYXRoKTtcbiAgY29uc3QgYmFzZW5hbWUgPSBuYW1lLnJlcGxhY2UoVEVNUExBVEVfSU5URVJQT0xBVEUsIHRlbXBsYXRlUmVwbGFjZXIpO1xuICByZXR1cm4gcGF0aC5qb2luKGRpcm5hbWUsIGAke2Jhc2VuYW1lfSR7ZXh0ID8gYC4ke2V4dH1gIDogJyd9YCk7XG59XG5cbi8qKlxuICogQHBhcmFtIHtvYmplY3R9ICAgICAgICBbb3B0aW9uc11cbiAqIEBwYXJhbSB7bnVtYmVyfSAgICAgICAgW29wdGlvbnMubW9kZT0wbzc3N11cbiAqIEBwYXJhbSB7QXJyYXk8b2JqZWN0Pn0gW2NoaWxkcmVuXVxuICogQHJldHVybiB7b2JqZWN0fSBkaXIgcHJvcHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpcihvcHRpb25zID0ge30sIGNoaWxkcmVuID0gW10pIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkob3B0aW9ucykpIHtcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1wYXJhbS1yZWFzc2lnbiAqL1xuICAgIGNoaWxkcmVuID0gb3B0aW9ucztcbiAgICBvcHRpb25zID0ge307XG4gICAgLyogZXNsaW50LWVuYWJsZSBuby1wYXJhbS1yZWFzc2lnbiAqL1xuICB9XG4gIGNvbnN0IHsgbW9kZSA9IERFRkFVTFRfRElSX01PREUgfSA9IG9wdGlvbnM7XG4gIGNvbnN0IHRlbXBEaXIgPSB7XG4gICAgZmlsZXBhdGg6IGZpbGVwYXRoKG9wdGlvbnMpLFxuICAgIGlzRGlyOiB0cnVlLFxuICAgIG1vZGUsXG4gIH07XG4gIHRyeSB7XG4gICAgZnMuYWNjZXNzU3luYyh0ZW1wRGlyLmZpbGVwYXRoLCBmcy5GX09LKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyci5jb2RlICE9PSAnRU5PRU5UJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgY2hlY2sgJHt0ZW1wRGlyLmZpbGVwYXRofS5gKTtcbiAgICB9XG4gICAgdGVtcERpci5jbGVhbnVwID0gcmVnaXN0ZXJDbGVhbnVwKCgpID0+IHtcbiAgICAgIGZzLnJtZGlyU3luYyh0ZW1wRGlyLmZpbGVwYXRoKTtcbiAgICB9KTtcbiAgICBjb25zdCBwYXJlbnREaXIgPSBwYXRoLmRpcm5hbWUodGVtcERpci5maWxlcGF0aCk7XG4gICAgZGlyKHtcbiAgICAgIGRpcjogcGF0aC5kaXJuYW1lKHBhcmVudERpciksXG4gICAgICBuYW1lOiBwYXRoLmJhc2VuYW1lKHBhcmVudERpciksXG4gICAgfSk7XG4gICAgZnMubWtkaXJTeW5jKHRlbXBEaXIuZmlsZXBhdGgsIG1vZGUpO1xuICAgIC8vIGRlYnVnKCdDUkVBVEVEIERJUicsIHRlbXBEaXIuZmlsZXBhdGgpO1xuICB9XG4gIGlmIChjaGlsZHJlbi5sZW5ndGggIT09IDApIHtcbiAgICB0ZW1wRGlyLmNoaWxkcmVuID0gY2hpbGRyZW4ubWFwKG1vdmVUbyh0ZW1wRGlyKSk7XG4gIH1cbiAgcmV0dXJuIHRlbXBEaXI7XG59XG5cbi8qKlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRhdGE9JyddXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZW5jb2Rpbmc9dXRmOF1cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tb2RlPTBvNjY2XVxuICogQHJldHVybiB7b2JqZWN0fSBmaWxlIHByb3BzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaWxlKG9wdGlvbnMgPSB7fSkge1xuICBjb25zdCB7XG4gICAgZGF0YSA9ICcnLFxuICAgIGVuY29kaW5nID0gREVGQVVMVF9FTkNPRElORyxcbiAgICBtb2RlID0gREVGQVVMVF9GSUxFX01PREUsXG4gIH0gPSBvcHRpb25zO1xuICBjb25zdCB0ZW1wRmlsZSA9IHtcbiAgICBkYXRhLFxuICAgIGZpbGVwYXRoOiBmaWxlcGF0aChvcHRpb25zKSxcbiAgICBpc0ZpbGU6IHRydWUsXG4gICAgbW9kZSxcbiAgfTtcbiAgY29uc3QgcGFyZW50RGlyID0gcGF0aC5kaXJuYW1lKHRlbXBGaWxlLmZpbGVwYXRoKTtcbiAgdGVtcEZpbGUuY2xlYW51cCA9IHJlZ2lzdGVyQ2xlYW51cCgoKSA9PiB7XG4gICAgZnMudW5saW5rU3luYyh0ZW1wRmlsZS5maWxlcGF0aCk7XG4gIH0pO1xuICB0cnkge1xuICAgIGZzLmFjY2Vzc1N5bmMocGFyZW50RGlyLCBmcy5GX09LKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyci5jb2RlICE9PSAnRU5PRU5UJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgY2hlY2sgJHtwYXJlbnREaXJ9LmApO1xuICAgIH1cbiAgICBkaXIoe1xuICAgICAgZGlyOiBwYXRoLmRpcm5hbWUocGFyZW50RGlyKSxcbiAgICAgIG5hbWU6IHBhdGguYmFzZW5hbWUocGFyZW50RGlyKSxcbiAgICB9KTtcbiAgfVxuICBmcy53cml0ZUZpbGVTeW5jKHRlbXBGaWxlLmZpbGVwYXRoLCBkYXRhLCB7IGVuY29kaW5nLCBtb2RlIH0pO1xuICAvLyBkZWJ1ZygnQ1JFQVRFRCBGSUxFJywgdGVtcEZpbGUuZmlsZXBhdGgpO1xuICByZXR1cm4gdGVtcEZpbGU7XG59XG5cbi8vIGF1dG8gY2xlYW4gdXBcblxucHJvY2Vzcy5vbignZXhpdCcsIGNsZWFudXApO1xuIl19