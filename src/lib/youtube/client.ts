const YT_BASE = 'https://www.googleapis.com/youtube/v3'

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY is not configured')
  return key
}

export interface YTChannel {
  id: string
  title: string
  handle?: string
  thumbnailUrl?: string
  subscriberCount?: number
}

export interface YTVideo {
  id: string
  title: string
  channelId: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl?: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
  url: string
}

export interface YTComment {
  id: string
  videoId: string
  videoTitle: string
  author: string
  text: string
  likeCount: number
  replyCount: number
  publishedAt: string
  url: string
}

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YT_BASE}/${path}`)
  url.searchParams.set('key', getApiKey())
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err?.error?.message || `YouTube API error: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function resolveChannel(identifier: string): Promise<YTChannel> {
  // identifier can be channel ID (UC...) or handle (@name) or URL
  let channelId = ''
  let handle = ''

  if (identifier.startsWith('UC')) {
    channelId = identifier
  } else if (identifier.startsWith('@')) {
    handle = identifier
  } else if (identifier.includes('youtube.com')) {
    const match = identifier.match(/@([^/\s?]+)/)
    if (match) handle = `@${match[1]}`
    const idMatch = identifier.match(/channel\/([^/\s?]+)/)
    if (idMatch) channelId = idMatch[1]
  } else {
    handle = identifier.startsWith('@') ? identifier : `@${identifier}`
  }

  interface ChannelListResponse {
    items?: Array<{
      id: string
      snippet: {
        title: string
        customUrl?: string
        thumbnails?: { default?: { url: string } }
      }
      statistics?: { subscriberCount?: string }
    }>
  }

  if (channelId) {
    const data = await ytFetch<ChannelListResponse>('channels', {
      part: 'snippet,statistics',
      id: channelId,
    })
    const item = data.items?.[0]
    if (!item) throw new Error(`Channel not found: ${channelId}`)
    return {
      id: item.id,
      title: item.snippet.title,
      handle: item.snippet.customUrl,
      thumbnailUrl: item.snippet.thumbnails?.default?.url,
      subscriberCount: item.statistics?.subscriberCount
        ? parseInt(item.statistics.subscriberCount)
        : undefined,
    }
  }

  if (handle) {
    const data = await ytFetch<ChannelListResponse>('channels', {
      part: 'snippet,statistics',
      forHandle: handle.replace('@', ''),
    })
    const item = data.items?.[0]
    if (!item) throw new Error(`Channel not found: ${handle}`)
    return {
      id: item.id,
      title: item.snippet.title,
      handle: item.snippet.customUrl,
      thumbnailUrl: item.snippet.thumbnails?.default?.url,
      subscriberCount: item.statistics?.subscriberCount
        ? parseInt(item.statistics.subscriberCount)
        : undefined,
    }
  }

  throw new Error('Could not resolve channel from: ' + identifier)
}

export async function getRecentVideos(
  channelId: string,
  maxResults = 10
): Promise<YTVideo[]> {
  interface SearchResponse {
    items?: Array<{ id: { videoId: string } }>
  }
  const search = await ytFetch<SearchResponse>('search', {
    part: 'id',
    channelId,
    order: 'date',
    type: 'video',
    maxResults: String(Math.min(maxResults, 50)),
  })

  const ids = search.items?.map((i) => i.id.videoId).filter(Boolean) ?? []
  if (ids.length === 0) return []

  interface VideoListResponse {
    items?: Array<{
      id: string
      snippet: {
        title: string
        channelId: string
        channelTitle: string
        publishedAt: string
        thumbnails?: { medium?: { url: string } }
      }
      statistics?: {
        viewCount?: string
        likeCount?: string
        commentCount?: string
      }
    }>
  }

  const videos = await ytFetch<VideoListResponse>('videos', {
    part: 'snippet,statistics',
    id: ids.join(','),
  })

  return (
    videos.items?.map((v) => ({
      id: v.id,
      title: v.snippet.title,
      channelId: v.snippet.channelId,
      channelTitle: v.snippet.channelTitle,
      publishedAt: v.snippet.publishedAt,
      thumbnailUrl: v.snippet.thumbnails?.medium?.url,
      viewCount: v.statistics?.viewCount ? parseInt(v.statistics.viewCount) : undefined,
      likeCount: v.statistics?.likeCount ? parseInt(v.statistics.likeCount) : undefined,
      commentCount: v.statistics?.commentCount
        ? parseInt(v.statistics.commentCount)
        : undefined,
      url: `https://www.youtube.com/watch?v=${v.id}`,
    })) ?? []
  )
}

export async function getVideoById(videoId: string): Promise<YTVideo | null> {
  interface VideoListResponse {
    items?: Array<{
      id: string
      snippet: {
        title: string
        channelId: string
        channelTitle: string
        publishedAt: string
        thumbnails?: { medium?: { url: string } }
      }
      statistics?: {
        viewCount?: string
        likeCount?: string
        commentCount?: string
      }
    }>
  }

  const data = await ytFetch<VideoListResponse>('videos', {
    part: 'snippet,statistics',
    id: videoId,
  })
  const v = data.items?.[0]
  if (!v) return null
  return {
    id: v.id,
    title: v.snippet.title,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    thumbnailUrl: v.snippet.thumbnails?.medium?.url,
    viewCount: v.statistics?.viewCount ? parseInt(v.statistics.viewCount) : undefined,
    likeCount: v.statistics?.likeCount ? parseInt(v.statistics.likeCount) : undefined,
    commentCount: v.statistics?.commentCount
      ? parseInt(v.statistics.commentCount)
      : undefined,
    url: `https://www.youtube.com/watch?v=${v.id}`,
  }
}

export async function extractVideoId(urlOrId: string): Promise<string | null> {
  const patterns = [
    /[?&]v=([^&\s]+)/,
    /youtu\.be\/([^?&\s]+)/,
    /youtube\.com\/embed\/([^?&\s]+)/,
    /youtube\.com\/shorts\/([^?&\s]+)/,
  ]
  for (const p of patterns) {
    const m = urlOrId.match(p)
    if (m) return m[1]
  }
  // Might be a raw video ID (11 chars alphanumeric)
  if (/^[A-Za-z0-9_-]{11}$/.test(urlOrId)) return urlOrId
  return null
}

export async function getVideoComments(
  videoId: string,
  videoTitle: string,
  maxResults = 100
): Promise<YTComment[]> {
  interface CommentThreadsResponse {
    items?: Array<{
      id: string
      snippet: {
        topLevelComment: {
          id: string
          snippet: {
            authorDisplayName: string
            textDisplay: string
            likeCount: number
            publishedAt: string
          }
        }
        totalReplyCount: number
      }
    }>
    nextPageToken?: string
  }

  const comments: YTComment[] = []
  let pageToken = ''
  const pageSize = Math.min(100, maxResults)

  while (comments.length < maxResults) {
    const params: Record<string, string> = {
      part: 'snippet',
      videoId,
      maxResults: String(pageSize),
      order: 'relevance',
    }
    if (pageToken) params.pageToken = pageToken

    let data: CommentThreadsResponse
    try {
      data = await ytFetch<CommentThreadsResponse>('commentThreads', params)
    } catch (err) {
      // Comments may be disabled on some videos
      console.warn(`Comments unavailable for video ${videoId}:`, err)
      break
    }

    for (const item of data.items ?? []) {
      const c = item.snippet.topLevelComment.snippet
      comments.push({
        id: item.snippet.topLevelComment.id,
        videoId,
        videoTitle,
        author: c.authorDisplayName,
        text: c.textDisplay,
        likeCount: c.likeCount,
        replyCount: item.snippet.totalReplyCount,
        publishedAt: c.publishedAt,
        url: `https://www.youtube.com/watch?v=${videoId}&lc=${item.snippet.topLevelComment.id}`,
      })
    }

    if (!data.nextPageToken || comments.length >= maxResults) break
    pageToken = data.nextPageToken
  }

  return comments.slice(0, maxResults)
}

export async function searchVideosByKeyword(
  keyword: string,
  maxResults = 10
): Promise<YTVideo[]> {
  interface SearchResponse {
    items?: Array<{ id: { videoId: string } }>
  }
  const search = await ytFetch<SearchResponse>('search', {
    part: 'id',
    q: keyword,
    order: 'relevance',
    type: 'video',
    maxResults: String(Math.min(maxResults, 50)),
    relevanceLanguage: 'en',
  })

  const ids = search.items?.map((i) => i.id.videoId).filter(Boolean) ?? []
  if (ids.length === 0) return []

  interface VideoListResponse {
    items?: Array<{
      id: string
      snippet: {
        title: string
        channelId: string
        channelTitle: string
        publishedAt: string
        thumbnails?: { medium?: { url: string } }
      }
      statistics?: {
        viewCount?: string
        likeCount?: string
        commentCount?: string
      }
    }>
  }

  const videos = await ytFetch<VideoListResponse>('videos', {
    part: 'snippet,statistics',
    id: ids.join(','),
  })

  return (
    videos.items?.map((v) => ({
      id: v.id,
      title: v.snippet.title,
      channelId: v.snippet.channelId,
      channelTitle: v.snippet.channelTitle,
      publishedAt: v.snippet.publishedAt,
      thumbnailUrl: v.snippet.thumbnails?.medium?.url,
      viewCount: v.statistics?.viewCount ? parseInt(v.statistics.viewCount) : undefined,
      likeCount: v.statistics?.likeCount ? parseInt(v.statistics.likeCount) : undefined,
      commentCount: v.statistics?.commentCount
        ? parseInt(v.statistics.commentCount)
        : undefined,
      url: `https://www.youtube.com/watch?v=${v.id}`,
    })) ?? []
  )
}
