import {App} from "shopware-app-server-sdk";
import {CloudflareShopRepository, convertRequest, convertResponse} from "shopware-app-server-sdk/runtime/cf-worker";
import {WebCryptoHmacSigner} from "shopware-app-server-sdk/component/signer";
import {Shop} from "shopware-app-server-sdk/shop";
import {generateRandomString} from "./utils/random";
import {HTTPCode} from "./utils/enum";
import { Config } from "shopware-app-server-sdk/config";
import { HttpClient } from "shopware-app-server-sdk/component/http-client";
import XMLBuilder from "./utils/xml";
import { getShopByAuth } from "./utils/auth";
import { Folder } from "./utils/tree";
import { extractFileName, resolveRoot as resolvePath, resolveRootOnFolder } from "./utils/path";
import { getMedia, MediaEntity } from "./utils/api";
import { getCacheKey, hasCacheKey, removeCacheKey, setCacheKey } from "./utils/cache";
import {GenMapping} from "@jridgewell/gen-mapping";
import {Options} from "@ampproject/remapping/dist/types/types";

const cfg: Config = {
    appName: 'FroshImagePlaceholder',
// @ts-ignore
    appSecret: 'abcdefg111',//globalThis.APP_SECRET,
    authorizeCallbackUrl: 'http://127.0.0.1:8787/authorize/callback',
};

const clientCache: any = [];
const thumbhashApiUrl = 'https://ehs457kytv5naezcbpdagnuvme0zfnro.lambda-url.eu-central-1.on.aws/';

export default {
    async fetch(request: Request, env: Environment): Promise<Response> {
        // deliver options fast as possible
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Allow': 'GET, POST',
                }
            });
        }

        const url = new URL(request.url);

        // @ts-ignore
        const app = new App(cfg, new CloudflareShopRepository(env.shopStorage), new WebCryptoHmacSigner());

        if (url.pathname.startsWith('/authorize/callback')) {
            const req = await convertRequest(request);

            const successHandler = async (shop: Shop) => {
                shop.customFields.password = generateRandomString(16);
                shop.customFields.active = false;
            };

            return await convertResponse(await app.registration.authorizeCallback(req, successHandler));
        }

        if (url.pathname.startsWith('/authorize')) {
            const req = await convertRequest(request);
            return await convertResponse(await app.registration.authorize(req));
        }

        if (url.pathname.startsWith('/hook/deleted')) {
            const req = await convertRequest(request);
            let source = null;

            // When the message queue is broken, we get requests about already uninstalled shops. Ignore it
            try {
                source = await app.contextResolver.fromSource(req);
            } catch (e) {}

            if (source) {
                await app.repository.deleteShop(source.shop);
            }

            return new Response(null, { status: HTTPCode.NoContent });
        }

        if (url.pathname.startsWith('/hook/activated') || url.pathname.startsWith('/hook/deactivated')) {
            return new Response(null, { status: HTTPCode.NoContent });
        }

        if (url.pathname.startsWith('/event/media-uploaded')) {
            const req = await convertRequest(request);
            let ctx : any;

            try {
                ctx = await app.contextResolver.fromSource(req);
            } catch (error) {
                return new Response('Shop unauthorized', { status: HTTPCode.BadRequest });
            }


            await env.IMAGE_QUEUE.send(new queueData(req.body, ctx.shop));

            return new Response(null, { status: HTTPCode.NoContent });
        }

        let response = new Response(null, {
            status: HTTPCode.MethodNotAllowed,
        });

        return response;
    },

    async queue(batch: MessageBatch<queueData>, env: Environment): Promise<void> {

        for (const message of batch.messages) {
            const httpClient = new HttpClient(message.body.shop);
            const body = message.body.body;

            const mediaIds: string[] = [];

            for (const payload of JSON.parse(body).data.payload) {
                if (payload.entity !== 'media') {
                    continue;
                }
                mediaIds.push(payload.primaryKey);
            }

            const result = await httpClient.post('/search/media/',
                {
                    'ids': mediaIds,
                });

            for (const data of result.body.data) {
                if (data.private) {
                    console.info('The mediaId ' + data.id + ' is private');
                    continue;
                }

                if (!data.url) {
                    console.info('There is no url for mediaId ' + data.id);
                    continue;
                }

                if (!data.hasFile) {
                    console.info('There is no file for mediaId ' + data.id);
                    continue;
                }

                if (data?.customFields?.frosh_image_placeholder_thumbhash) {
                    console.info('There is a thumbhash for mediaId ' + data.id);
                    continue;
                }

                const fileType = data.mimeType.split('/').slice(-1);

                const hash = await generateThumbhash(data.url, fileType);

                if (!hash) {
                    console.info('The hash for ' + data.url + ' is empty. fileType ' + fileType);
                    continue;
                }

                console.info('Saving hash ' + hash + ' for mediaId ' + data.id);

                await httpClient.patch('/media/' + data.id,
                    {
                        'customFields': {
                            'frosh_image_placeholder_thumbhash': hash
                        }
                    }
                );
            }
        }
    },
};

export async function generateThumbhash(imageUrl: string, fileType: string, tries: number = 3): Promise<string> {
    const url = new URL(thumbhashApiUrl);
    url.searchParams.append('url', imageUrl);
    url.searchParams.append('format', fileType);
    const res = await fetch(url.toString());

    if (!res.ok) {
        if (tries > 0) {
            console.info('Retry ' + imageUrl);
            tries--;
            await Sleep(5000);
            return await generateThumbhash(imageUrl, fileType, tries);
        }

        return '';
    }

    const resultText = (await res.text());

    //TODO: change in API! there should be no JSON
    return JSON.parse(resultText).data_url;

}

function Sleep(milliseconds: number = 100) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}


export class queueData {
    body: string
    shop: Shop

    constructor(body: string, shop: Shop) {
        this.body = body
        this.shop = shop
    }
};
