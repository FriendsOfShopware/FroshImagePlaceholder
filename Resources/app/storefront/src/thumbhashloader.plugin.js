import Plugin from 'src/plugin-system/plugin.class';
const thumbhash = require('thumbhash');

window.ThumbhashloaderPluginImageCache = [];

export default class ThumbhashloaderPlugin extends Plugin {
    init() {
        const thumbhashstring = this.el.dataset.thumbhash;
        if (!thumbhashstring) {
            return;
        }

        this.el.src = this.getImage(thumbhashstring);

        this.el.dataset.thumbhash = '';
    }

    getImage(thumbhashstring) {
        const hash = this.convertStringToHash(thumbhashstring);
        return thumbhash.thumbHashToDataURL(hash);
    }

    convertStringToHash(str) {
        return Array.from(atob(str)).map(c => c.charCodeAt(0))
    }
}
