const loaderUtils = require("loader-utils");
const path = require('path');
const jsesc = require('jsesc');

module.exports = function (content) {
    this.cacheable && this.cacheable();

    const options = loaderUtils.getOptions(this) || {};
    const ngModule = getAndInterpolateOption.call(this, 'module', 'ng'); // ng is the global angular module that does not need to explicitly required
    const relativeTo = getAndInterpolateOption.call(this, 'relativeTo', '');
    const prefix = getAndInterpolateOption.call(this, 'prefix', '');
    const requireAngular = !!options.requireAngular || false;
    const absolute = false;
    const pathSep = options.pathSep || '/';
    const resource = this.resource;
    const pathSepRegex = new RegExp(escapeRegExp(path.sep), 'g');

    // if a unix path starts with // we treat is as an absolute path e.g. //Users/wearymonkey
    // if we're on windows, then we ignore the / prefix as windows absolute paths are unique anyway e.g. C:\Users\wearymonkey
    if (relativeTo[0] === '/') {
        if (path.sep === '\\') { // we're on windows
            relativeTo = relativeTo.substring(1);
        } else if (relativeTo[1] === '/') {
            absolute = true;
            relativeTo = relativeTo.substring(1);
        }
    }

    // normalise the path separators
    if (path.sep !== pathSep) {
        relativeTo = relativeTo.replace(pathSepRegex, pathSep);
        prefix = prefix.replace(pathSepRegex, pathSep);
        resource = resource.replace(pathSepRegex, pathSep)
    }

    const relativeToIndex = resource.indexOf(relativeTo);
    if (relativeToIndex === -1 || (absolute && relativeToIndex !== 0)) {
        throw new Error('The path for file doesn\'t contain relativeTo param');
    }

    // a custom join of prefix using the custom path sep
    const filePath = [prefix, resource.slice(relativeToIndex + relativeTo.length)]
        .filter(Boolean)
        .join(pathSep)
        .replace(new RegExp(escapeRegExp(pathSep) + '+', 'g'), pathSep);
    let html;

    if (content.match(/^module\.exports/) || content.match(/^(var|let|const) code/m)) {
        const firstQuote = findQuote(content, false);
        const secondQuote = findQuote(content, true);
        html = content.substr(firstQuote, secondQuote - firstQuote + 1);
    } else {
        html = content;
    }

    return `var path = '${jsesc(filePath)}';
        var html = ${html};
        ${requireAngular ? "var angular = require('angular');\n" : "window."}
        angular.module('${ngModule}').run(['$templateCache', function(c) { c.put(path, html); }]);
        module.exports = path;`;

    function getAndInterpolateOption(optionKey, def) {
        return options[optionKey]
            ? loaderUtils.interpolateName(this, options[optionKey], {
                context: options.context,
                content: content,
                regExp: options[optionKey + 'RegExp'] || options['regExp']
            })
            : def
    }

    function findQuote(content, backwards) {
        var i = backwards ? content.length - 1 : 0;
        while (i >= 0 && i < content.length) {
            if (content[i] === '"' || content[i] === "'") {
                return i;
            }
            i += backwards ? -1 : 1;
        }
        return -1;
    }

    // source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Using_Special_Characters
    function escapeRegExp(string) {
        return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }
};
