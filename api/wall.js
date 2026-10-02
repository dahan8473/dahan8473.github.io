// The public note wall at /notes/.

import { corsFor, plain, json } from './_http.js';
import { wallNotes } from './_store.js';

export default {
  async fetch(request) {
    const { ok, headers } = corsFor(request);
    if (request.method !== 'GET') return plain('GET only', headers, 405);
    if (!ok) return plain('forbidden', headers, 403);
    return json(await wallNotes(), { ...headers, 'cache-control': 'public, s-maxage=15' });
  }
};
