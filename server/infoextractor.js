const URL = require("url");
const _ = require("lodash");
const DailyMotionAdapter = require("./services/dailymotion");
const GoogleDriveAdapter = require("./services/googledrive");
const VimeoAdapter = require("./services/vimeo");
const YouTubeAdapter = require("./services/youtube");
const DirectVideoAdapter = require("./services/direct");
const storage = require("../storage");
const Video = require("../common/video");
const { UnsupportedMimeTypeException, OutOfQuotaException } = require("./exceptions");
const { getLogger } = require("../logger");

const log = getLogger("infoextract");

const adapters = [
  new DailyMotionAdapter(),
  new GoogleDriveAdapter(),
  new VimeoAdapter(),
  new YouTubeAdapter(process.env.YOUTUBE_API_KEY),
  new DirectVideoAdapter(),
];

function isURL(str) {
  return URL.parse(str).host != null;
}

/**
 * Returns a cached video and an array with property names. The property names indicate which
 * properties are still missing from the cache. On a cache miss, this function will return an empty
 * video object.
 * @param {string} service
 * @param {string} videoId
 * @returns {[string, string[]]}
 */
async function getCachedVideo(service, videoId) {
  try {
    const result = await storage.getVideoInfo(service, videoId);
    const video = new Video(result);
    const missingInfo = storage
      .getVideoInfoFields(video.service)
      .filter(p => video[p] == null);

    if (video.mime && !this.isSupportedMimeType(video.mime)) {
      throw new UnsupportedMimeTypeException(video.mime);
    }

    return [video, missingInfo];
  }
  catch (e) {
    log.error(`Failed to get video metadata: ${e}`);
    throw e;
  }
}

/**
 * Writes video info objects to the database.
 * @param {Video} videos
 * @returns {Promise}
 */
async function updateCache(videos) {
  if (Array.isArray(videos)) {
    return storage.updateManyVideoInfo(videos);
  }
  else {
    return storage.updateVideoInfo(videos);
  }
}

/**
 * Returns the adapter instance for a given service name.
 * @param {string} service
 * @returns {ServiceAdapter}
 */
function getServiceAdapter(service) {
  return adapters.find(adapter => adapter.serviceId === service);
}

/**
 * Returns the adapter that can handle a given URL.
 * @param {string} url
 * @returns {ServiceAdapter}
 */
function getServiceAdapterForURL(url) {
  return adapters.find(adapter => adapter.canHandleLink(url));
}

/**
 * Returns metadata for a single video. Uses cached info if possible and writes newly fetched info
 * to the cache.
 * @param {string} service
 * @param {string} videoId
 * @returns {Video}
 */
async function getVideoInfo(service, videoId) {
  const adapter = getServiceAdapter(service);
  const [cachedVideo, missingInfo] = await getCachedVideo(service, videoId);

  if (missingInfo.length === 0) {
    return cachedVideo;
  }
  else {
    log.warn(`MISSING INFO for ${cachedVideo.service}:${cachedVideo.id}: ${missingInfo}`);

    try {
      const fetchedVideo = await adapter.fetchVideoInfo(cachedVideo.id, missingInfo);
      const video = Video.merge(cachedVideo, fetchedVideo);
      updateCache(video);
      return video;
    }
    catch (e) {
      if (e instanceof OutOfQuotaException) {
        log.error("Failed to get video info: Out of quota");
        if (missingInfo.length < storage.getVideoInfoFields(cachedVideo.service).length) {
          log.warn(`Returning incomplete cached result for ${cachedVideo.service}:${cachedVideo.id}`);
          return cachedVideo;
        }
        else {
          throw e;
        }
      }
      else {
        log.error(`Failed to get video info for ${cachedVideo.service}:${cachedVideo.id}: ${e}`);
        throw e;
      }
    }
  }
}

async function getManyVideoInfo(videos) {
  const grouped = _.groupBy(videos, "service");
  const results = await Promise.all(Object.entries(grouped).map(async ([service, serviceVideos]) => {
    // Handle each service separately
    const cachedVideos = await storage.getManyVideoInfo(serviceVideos);
    const requests = cachedVideos
      .map(video => ({
        id: video.id,
        missingInfo: storage.getVideoInfoFields(video.service).filter(p => video[p] == null),
      }))
      .filter(request => request.missingInfo.length > 0);

    if (requests.length === 0) {
      return cachedVideos;
    }

    const adapter = getServiceAdapter(service);
    const fetchedVideos = await adapter.getManyVideoInfo(requests);
    return cachedVideos.map(video => {
      const fetchedVideo = fetchedVideos.find(v => v.id === video.id);
      if (fetchedVideo) {
        return Video.merge(video, fetchedVideo);
      }
      else {
        return video;
      }
    });
  }));

  const flattened = results.flat();
  const result = videos.map(video => flattened.find(v => v.id === video.id));
  updateCache(result);
  return result;
}

/**
 * Turns a search query into a list of videos, regardless of whether it contains a link to a single
 * video or a video collection, or search terms to run against an API. If query is a URL, a service
 * adapter will automatically be selected to handle it. If it is not a URL, searchService will be
 * used to perform a search.
 * @param {string} query
 * @param {string} searchService
 * @returns {Video[]}
 */
async function resolveVideoQuery(query, searchService) {
  const results = [];

  if (isURL(query)) {
    const adapter = getServiceAdapterForURL(query);

    if (!adapter.isCollectionURL(query)) {
      return [
        await getVideoInfo(
          adapter.serviceId,
          adapter.getVideoId(query)
        ),
      ];
    }

    const fetchResults = await adapter.resolveURL(query);
    results.push(...fetchResults);
  }
  else {
    const searchResults = await searchVideos(searchService, query);
    results.push(...searchResults);
  }

  updateCache(results);
  return results;
}

/**
 * Performs a search on a given video service.
 * @param {string} service
 * @param {string} query
 * @returns {Video[]}
 */
function searchVideos(service, query) {
  const adapter = getServiceAdapter(service);
  return adapter.searchVideos(query);
}

module.exports = {
  getServiceAdapter,
  getServiceAdapterForURL,
  getVideoInfo,
  getManyVideoInfo,
  resolveVideoQuery,
  searchVideos,
};
