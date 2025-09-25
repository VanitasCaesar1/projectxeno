export interface MediaConfig {
  title: string;
  placeholder: string;
  popularQuery: string;
  trendingQuery: string;
  topRatedQuery: string;
}

export const mediaConfigs: Record<string, MediaConfig> = {
  movie: {
    title: 'Movies',
    placeholder: 'Search movies...',
    popularQuery: 'action',
    trendingQuery: 'marvel',
    topRatedQuery: 'oscar'
  },
  tv: {
    title: 'TV Shows',
    placeholder: 'Search TV shows...',
    popularQuery: 'drama',
    trendingQuery: 'netflix',
    topRatedQuery: 'emmy'
  },
  book: {
    title: 'Books',
    placeholder: 'Search books...',
    popularQuery: 'bestseller',
    trendingQuery: 'fiction',
    topRatedQuery: 'classic'
  },
  anime: {
    title: 'Anime',
    placeholder: 'Search anime...',
    popularQuery: 'shounen',
    trendingQuery: 'seasonal',
    topRatedQuery: 'myanimelist'
  },
  manga: {
    title: 'Manga',
    placeholder: 'Search manga...',
    popularQuery: 'shounen',
    trendingQuery: 'weekly',
    topRatedQuery: 'award'
  }
};

export function getMediaConfig(mediaType: string): MediaConfig {
  return mediaConfigs[mediaType] || mediaConfigs.movie;
}

export interface ContentSection {
  id: string;
  title: string;
  type: 'popular' | 'trending' | 'top_rated' | 'recommended';
  query?: string;
  filters?: Record<string, any>;
}

export function getDefaultSections(mediaType: string, includeRecommended: boolean = false): ContentSection[] {
  const config = getMediaConfig(mediaType);
  
  const sections: ContentSection[] = [
    { 
      id: 'popular', 
      title: `Popular ${config.title}`, 
      type: 'popular',
      query: config.popularQuery
    },
    { 
      id: 'trending', 
      title: `Trending ${config.title}`, 
      type: 'trending',
      query: config.trendingQuery
    },
    { 
      id: 'top_rated', 
      title: `Top Rated ${config.title}`, 
      type: 'top_rated',
      query: config.topRatedQuery
    }
  ];

  // Add recommended section for logged-in users
  if (includeRecommended) {
    sections.unshift({
      id: 'recommended',
      title: `Recommended ${config.title}`,
      type: 'recommended'
    });
  }

  return sections;
}

export function getSectionQuery(sectionType: string, mediaType: string): string {
  const config = getMediaConfig(mediaType);
  
  switch (sectionType) {
    case 'popular':
      return config.popularQuery;
    case 'trending':
      return config.trendingQuery;
    case 'top_rated':
      return config.topRatedQuery;
    default:
      return config.popularQuery;
  }
}