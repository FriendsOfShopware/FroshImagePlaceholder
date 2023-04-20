import Plugin from 'src/plugin-system/plugin.class';
const thumbhash = require('thumbhash');

window.ThumbhashloaderPluginImageCache = [];

export default class ThumbhashloaderPlugin extends Plugin {
    init() {
        const thumbhashstring = this.el.dataset.thumbhash;
        if (!thumbhashstring) {
            return;
        }

        this.load(this.el, thumbhashstring);

        this.el.dataset.thumbhash = '';
    }

    getImageFromThumbHashString(thumbhashstring) {
        const hash = this.convertStringToHash(thumbhashstring);
        return thumbhash.thumbHashToDataURL(hash);
    }

    convertStringToHash(str) {
        return Array.from(atob(str)).map(c => c.charCodeAt(0))
    }

    load(image, thumbhashstring) {
        const img = new Image();
        img.onload = function () {
            image.src = img.src;
            img.onload = null;
            image.style.aspectRatio = image.getAttribute('width') + '/' + image.getAttribute('height');

            //TODO: remove timeout, it's just for presentation
            setTimeout(
                function() {
                    if (image.dataset.src) {
                        image.dataset.src = '';
                        image.src = image.dataset.src;
                    }
                    if (image.dataset.srcset) {
                        image.srcset = image.dataset.srcset;
                        image.dataset.srcset = '';
                    }

                    image.classList.remove('thumbhashloader');
                    image.classList.add('thumbhashloaded');
            }, 2000);
        }
        img.src = this.getImageFromThumbHashString(thumbhashstring);
        image.dataset.src = img.src;
    }
}
