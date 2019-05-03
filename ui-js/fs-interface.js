/**
 * An abstraction layer that separates Coq build utility classes from the
 * actual filesystem implementation, in much a similar way to how MlNodeDevice
 * and MlFakeDevice operate in js_of_ocaml.
 * 
 * This layer allows such classes to function with other sources for files,
 * such as Zip bundles of .v/.vo entries.
 * 
 * In this case, however, the interface has to adhere to JavaScript standards.
 * The substituted interfaces are:
 * - fs: readFileSync, writeFileSync, statSync
 * - path: join, dirname, basename, isAbsolute
 * - glob: sync
 */

const minimatch = require('minimatch');

var fsif_native;

if (typeof process !== 'undefined') {
    const node_require = require, /* bypass browserify */


     fs = node_require('fs'),
          glob = node_require('glob'),
          path = node_require('path');

    /* Node.js filesystem */
    fsif_native = {fs, path, glob};
}
else {
    fsif_native = {};  // stub
}


/**
 * Files stored in a Map.
 */
class FileStore {

    constructor() {
        this.fsif = {
            fs: {
                readFileSync: (fn, enc) => this.readFileSync(fn, enc),
                statSync: (fn) => this.statSync(fn)
            },
            path: path_polyfill,
            glob: {
                sync: (pat, opts) => this.globSync(pat, opts)
            }
        }
        this.file_map = new Map();
    }

    create(filename, content) {
        this.file_map.set(filename, content);
    }

    addFrom(fsif, root_dir, glob_pattern) {
        for (let fn of fsif.glob.sync(glob_pattern, {cwd: root_dir})) {
            var content = fsif.fs.readFileSync(fsif.path.join(root_dir, fn));
            this.create(fn, content);
        }
    }

    files() {
        return this.file_map.keys();
    }

    folders() {
        var s = new Set();
        for (let fn of this.files()) {
            let pels = fn.split('/');
            for (let i = 1; i < pels.length; i++) {
                s.add(pels.slice(0, i).join('/'));
            }
        }
        return s;
    }

    readFileSync(filename, encoding=null) {
        var contents = this.file_map.get(filename);
        if (contents) {
            return encoding ? contents.toString('utf-8') : contents;
        }
        else throw new Error(`ENOENT: '${filename}'`);
    }

    statSync(filename) {
        if (this.file_map.has(filename)) return {isDirectory: () => false};
        else if (this.folders().has(filename)) return {isDirectory: () => true};
        else throw new Error(`ENOENT: '${filename}'`);
    }

    globSync(pattern, options={}) {
        var results = [], entries;

        if (pattern.endsWith('/')) {
            pattern = pattern.slice(0, -1);
            entries = this.folders();
        }
        else
            entries = this.files();

        for (let entry of entries) {
            if (options.cwd) {
                if (entry.startsWith(options.cwd + '/'))
                    entry = entry.substring(options.cwd.length + 1);
                else
                    continue;
            }
            if (minimatch(entry, pattern))
                results.push(entry);
        }
        return results;
    }
}


const path_polyfill = {
    join(...paths) {
        if (paths.length === 0) return '.';
        var cwd = paths[0];
        for (let p of paths.slice(1)) {
            for (let pel of p.split('/')) {
                if (pel === '' || pel === '.') continue;
                else if (pel === '..') cwd = this.dirname(cwd);
                else cwd = `${cwd}/${pel}`;
            }
        }
        return cwd;
    },
    basename(p) {
        return p.replace(/^.*[/]/, '');
    },
    dirname(p) {
        return p.replace(/(^|[/])[^/]*$/, '') ||
            (this.isAbsolute(p) ? '/' : '.');
    },
    isAbsolute(p) {
        return p.startsWith('/');
    }
}



module.exports = {fsif_native, FileStore}
