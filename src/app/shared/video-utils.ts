import { Exercise, PlanItem, VideoSource } from './models';

export interface ResolvedVideoSource {
  type: 'S3' | 'YOUTUBE';
  url: string;
}

type ExerciseLike = Exercise | PlanItem | Record<string, any> | null | undefined;

function asRecord(exercise: ExerciseLike): Record<string, any> {
  return (exercise || {}) as Record<string, any>;
}

function getVideoObject(exercise: ExerciseLike): Partial<VideoSource> & Record<string, any> {
  const record = asRecord(exercise);
  return (record['video'] || {}) as Partial<VideoSource> & Record<string, any>;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function extractYoutubeId(url: string | null | undefined): string {
  const safeUrl = nonEmpty(url);
  if (!safeUrl) return '';

  const regExp = /(?:youtube\.com.*(?:v=|embed\/)|youtu\.be\/)([^?&/]+)/;
  const match = safeUrl.match(regExp);
  return match ? match[1] : '';
}

export function buildYoutubeEmbedUrl(url: string | null | undefined): string | null {
  const videoId = extractYoutubeId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

export function buildYoutubeThumbnailUrl(url: string | null | undefined): string | null {
  const videoId = extractYoutubeId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

export function getS3PreviewUrl(exercise: ExerciseLike): string | null {
  const record = asRecord(exercise);
  const video = getVideoObject(exercise);

  return nonEmpty(video.previewUrl)
    || (nonEmpty(video.type) === 'S3' ? nonEmpty(video.url) : null)
    || nonEmpty(record['previewUrl'])
    || nonEmpty(record['preview_url']);
}

export function getYoutubeUrl(exercise: ExerciseLike): string | null {
  const record = asRecord(exercise);
  const video = getVideoObject(exercise);

  return nonEmpty(video.youtubeUrl)
    || (nonEmpty(video.type) === 'YOUTUBE' ? nonEmpty(video.url) : null)
    || nonEmpty(record['youtube_url']);
}

export function getVideoSource(exercise: ExerciseLike): ResolvedVideoSource | null {
  const s3PreviewUrl = getS3PreviewUrl(exercise);
  if (s3PreviewUrl) {
    return {
      type: 'S3',
      url: s3PreviewUrl
    };
  }

  const youtubeUrl = getYoutubeUrl(exercise);
  if (youtubeUrl) {
    return {
      type: 'YOUTUBE',
      url: youtubeUrl
    };
  }

  return null;
}

export function getThumbnailSource(exercise: ExerciseLike): string | null {
  const record = asRecord(exercise);
  const video = getVideoObject(exercise);

  const explicitThumbnail = nonEmpty(video.thumbnailUrl)
    || nonEmpty(record['thumbnailUrl'])
    || nonEmpty(record['thumbnail']);

  if (explicitThumbnail) {
    return explicitThumbnail;
  }

  return buildYoutubeThumbnailUrl(getYoutubeUrl(exercise));
}
