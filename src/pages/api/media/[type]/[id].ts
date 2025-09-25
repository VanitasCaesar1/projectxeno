import type { APIRoute } from "astro";
import { supabase } from "../../../../lib/supabase";

interface DetailedMediaItem {
  id: string;
  externalId: string;
  title: string;
  originalTitle?: string;
  type: "movie" | "tv" | "book" | "anime" | "manga";
  year?: number;
  releaseDate?: string;
  poster?: string;
  backdrop?: string;
  description?: string;
  rating?: number;
  voteCount?: number;
  genres: string[];
  runtime?: number;
  status?: string;
  language?: string;
  director?: string;
  cast?: string[];
  author?: string;
  publisher?: string;
  pages?: number;
  isbn?: string;
  studio?: string;
  episodes?: number;
  season?: string;
  source: "tmdb" | "openlibrary" | "jikan";
  metadata: Record<string, any>;
}

// Utility function to normalize metadata across different sources
function normalizeMediaItem(item: any, source: string): DetailedMediaItem {
  // Ensure all required fields have default values
  return {
    ...item,
    genres: item.genres || [],
    metadata: item.metadata || {},
    source: source as "tmdb" | "openlibrary" | "jikan",
  };
}

// Enhanced error handling
class MediaAPIError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = "MediaAPIError";
  }
}

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(source: string): boolean {
  const now = Date.now();
  const key = `${source}-rate-limit`;
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }

  if (limit.count >= 10) {
    // 10 requests per minute per source
    return false;
  }

  limit.count++;
  return true;
}

// Enhanced TMDB detailed fetch functions
async function fetchTMDBMovie(id: string): Promise<DetailedMediaItem | null> {
  const apiKey = import.meta.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new MediaAPIError("TMDB API key not configured", 500);
  }

  if (!checkRateLimit("tmdb")) {
    throw new MediaAPIError("Rate limit exceeded for TMDB API", 429);
  }

  try {
    const [movieResponse, creditsResponse, videosResponse] = await Promise.all([
      fetch(
        `https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&append_to_response=keywords,reviews`
      ),
      fetch(
        `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${apiKey}`
      ),
      fetch(
        `https://api.themoviedb.org/3/movie/${id}/videos?api_key=${apiKey}`
      ),
    ]);

    if (!movieResponse.ok) {
      if (movieResponse.status === 404) {
        throw new MediaAPIError("Movie not found", 404);
      }
      throw new MediaAPIError(
        `TMDB API error: ${movieResponse.status}`,
        movieResponse.status
      );
    }

    const movie = await movieResponse.json();
    const credits = creditsResponse.ok ? await creditsResponse.json() : null;
    const videos = videosResponse.ok ? await videosResponse.json() : null;

    const director = credits?.crew?.find(
      (person: any) => person.job === "Director"
    )?.name;
    const cast =
      credits?.cast?.slice(0, 15).map((actor: any) => ({
        name: actor.name,
        character: actor.character,
        profilePath: actor.profile_path,
      })) || [];

    const trailer = videos?.results?.find(
      (video: any) => video.type === "Trailer" && video.site === "YouTube"
    );

    const item = {
      id: `tmdb-${movie.id}`,
      externalId: movie.id.toString(),
      title: movie.title,
      originalTitle:
        movie.original_title !== movie.title ? movie.original_title : undefined,
      type: "movie" as const,
      year: movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : undefined,
      releaseDate: movie.release_date,
      poster: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : undefined,
      backdrop: movie.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
        : undefined,
      description: movie.overview || undefined,
      rating: movie.vote_average || undefined,
      voteCount: movie.vote_count || undefined,
      genres: movie.genres?.map((g: any) => g.name) || [],
      runtime: movie.runtime || undefined,
      status: movie.status || undefined,
      language: movie.original_language || undefined,
      director,
      cast: cast.map((c) => c.name),
      source: "tmdb" as const,
      metadata: {
        budget: movie.budget,
        revenue: movie.revenue,
        homepage: movie.homepage,
        imdbId: movie.imdb_id,
        tagline: movie.tagline,
        productionCompanies:
          movie.production_companies?.map((c: any) => c.name) || [],
        productionCountries:
          movie.production_countries?.map((c: any) => c.name) || [],
        spokenLanguages:
          movie.spoken_languages?.map((l: any) => l.english_name) || [],
        keywords: movie.keywords?.keywords?.map((k: any) => k.name) || [],
        castWithDetails: cast,
        crew: credits?.crew?.slice(0, 20) || [],
        trailerKey: trailer?.key,
        certification: movie.releases?.countries?.find(
          (c: any) => c.iso_3166_1 === "US"
        )?.certification,
        popularity: movie.popularity,
        adult: movie.adult,
      },
    };

    return normalizeMediaItem(item, "tmdb");
  } catch (error) {
    if (error instanceof MediaAPIError) {
      throw error;
    }
    console.error("TMDB movie fetch error:", error);
    throw new MediaAPIError("Failed to fetch movie details from TMDB", 500);
  }
}

async function fetchTMDBTV(id: string): Promise<DetailedMediaItem | null> {
  const apiKey = import.meta.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new MediaAPIError("TMDB API key not configured", 500);
  }

  if (!checkRateLimit("tmdb")) {
    throw new MediaAPIError("Rate limit exceeded for TMDB API", 429);
  }

  try {
    const [tvResponse, creditsResponse, videosResponse] = await Promise.all([
      fetch(
        `https://api.themoviedb.org/3/tv/${id}?api_key=${apiKey}&append_to_response=keywords,content_ratings`
      ),
      fetch(`https://api.themoviedb.org/3/tv/${id}/credits?api_key=${apiKey}`),
      fetch(`https://api.themoviedb.org/3/tv/${id}/videos?api_key=${apiKey}`),
    ]);

    if (!tvResponse.ok) {
      if (tvResponse.status === 404) {
        throw new MediaAPIError("TV show not found", 404);
      }
      throw new MediaAPIError(
        `TMDB API error: ${tvResponse.status}`,
        tvResponse.status
      );
    }

    const tv = await tvResponse.json();
    const credits = creditsResponse.ok ? await creditsResponse.json() : null;
    const videos = videosResponse.ok ? await videosResponse.json() : null;

    const cast =
      credits?.cast?.slice(0, 15).map((actor: any) => ({
        name: actor.name,
        character: actor.character,
        profilePath: actor.profile_path,
      })) || [];

    const creators = tv.created_by?.map((creator: any) => creator.name) || [];
    const trailer = videos?.results?.find(
      (video: any) => video.type === "Trailer" && video.site === "YouTube"
    );

    const item = {
      id: `tmdb-${tv.id}`,
      externalId: tv.id.toString(),
      title: tv.name,
      originalTitle:
        tv.original_name !== tv.name ? tv.original_name : undefined,
      type: "tv" as const,
      year: tv.first_air_date
        ? new Date(tv.first_air_date).getFullYear()
        : undefined,
      releaseDate: tv.first_air_date,
      poster: tv.poster_path
        ? `https://image.tmdb.org/t/p/w500${tv.poster_path}`
        : undefined,
      backdrop: tv.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${tv.backdrop_path}`
        : undefined,
      description: tv.overview || undefined,
      rating: tv.vote_average || undefined,
      voteCount: tv.vote_count || undefined,
      genres: tv.genres?.map((g: any) => g.name) || [],
      episodes: tv.number_of_episodes || undefined,
      season: tv.number_of_seasons
        ? `${tv.number_of_seasons} season${
            tv.number_of_seasons !== 1 ? "s" : ""
          }`
        : undefined,
      status: tv.status || undefined,
      language: tv.original_language || undefined,
      cast: cast.map((c) => c.name),
      director: creators.length > 0 ? creators.join(", ") : undefined,
      source: "tmdb" as const,
      metadata: {
        homepage: tv.homepage,
        networks: tv.networks?.map((n: any) => n.name) || [],
        productionCompanies:
          tv.production_companies?.map((c: any) => c.name) || [],
        productionCountries:
          tv.production_countries?.map((c: any) => c.name) || [],
        spokenLanguages:
          tv.spoken_languages?.map((l: any) => l.english_name) || [],
        lastAirDate: tv.last_air_date,
        inProduction: tv.in_production,
        creators: creators,
        keywords: tv.keywords?.results?.map((k: any) => k.name) || [],
        castWithDetails: cast,
        crew: credits?.crew?.slice(0, 20) || [],
        trailerKey: trailer?.key,
        contentRating: tv.content_ratings?.results?.find(
          (r: any) => r.iso_3166_1 === "US"
        )?.rating,
        popularity: tv.popularity,
        seasons:
          tv.seasons?.map((s: any) => ({
            seasonNumber: s.season_number,
            episodeCount: s.episode_count,
            airDate: s.air_date,
            name: s.name,
            overview: s.overview,
            posterPath: s.poster_path,
          })) || [],
      },
    };

    return normalizeMediaItem(item, "tmdb");
  } catch (error) {
    if (error instanceof MediaAPIError) {
      throw error;
    }
    console.error("TMDB TV fetch error:", error);
    throw new MediaAPIError("Failed to fetch TV show details from TMDB", 500);
  }
}

// Enhanced Open Library detailed fetch
async function fetchOpenLibraryBook(
  id: string
): Promise<DetailedMediaItem | null> {
  if (!checkRateLimit("openlibrary")) {
    throw new MediaAPIError("Rate limit exceeded for Open Library API", 429);
  }

  try {
    // Extract the work key from the id (format: ol-OL123W)
    const workKey = id.replace("ol-", "");
    
    // Ensure the work key has the /works/ prefix
    const fullWorkKey = workKey.startsWith('/works/') ? workKey : `/works/${workKey}`;

    const response = await fetch(`https://openlibrary.org${fullWorkKey}.json`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new MediaAPIError("Book not found", 404);
      }
      throw new MediaAPIError(
        `Open Library API error: ${response.status}`,
        response.status
      );
    }

    const book = await response.json();

    // Fetch additional edition data and author details
    let editionData = null;
    let authorDetails = [];

    // Get the most popular edition
    if (book.editions && book.editions.length > 0) {
      try {
        const editionResponse = await fetch(
          `https://openlibrary.org${book.editions[0]}.json`
        );
        if (editionResponse.ok) {
          editionData = await editionResponse.json();
        }
      } catch (e) {
        // Edition data is optional
      }
    }

    // Fetch author details
    if (book.authors && book.authors.length > 0) {
      try {
        const authorPromises = book.authors
          .slice(0, 3)
          .map(async (author: any) => {
            if (author.author && author.author.key) {
              const authorResponse = await fetch(
                `https://openlibrary.org${author.author.key}.json`
              );
              if (authorResponse.ok) {
                const authorData = await authorResponse.json();
                return {
                  name: authorData.name,
                  bio: authorData.bio,
                  birthDate: authorData.birth_date,
                  deathDate: authorData.death_date,
                };
              }
            }
            return null;
          });

        const authors = await Promise.all(authorPromises);
        authorDetails = authors.filter(Boolean);
      } catch (e) {
        // Author details are optional
      }
    }

    // Parse description
    let description = book.description;
    if (typeof description === "object" && description?.value) {
      description = description.value;
    }

    const item = {
      id: `ol-${workKey}`,
      externalId: workKey,
      title: book.title,
      type: "book" as const,
      year: book.first_publish_date
        ? new Date(book.first_publish_date).getFullYear()
        : undefined,
      releaseDate: book.first_publish_date,
      poster: book.covers?.[0]
        ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-L.jpg`
        : undefined,
      description: description || undefined,
      genres: book.subjects?.slice(0, 15) || [],
      author: book.authors
        ?.map(
          (a: any) =>
            a.name || authorDetails.find((ad) => ad)?.name || "Unknown Author"
        )
        .join(", "),
      publisher: editionData?.publishers?.[0] || undefined,
      pages: editionData?.number_of_pages || undefined,
      isbn: editionData?.isbn_13?.[0] || editionData?.isbn_10?.[0] || undefined,
      language:
        editionData?.languages?.[0]?.key?.replace("/languages/", "") ||
        undefined,
      source: "openlibrary" as const,
      metadata: {
        subtitle: book.subtitle,
        deweyDecimalClass: book.dewey_decimal_class,
        lcClassifications: book.lc_classifications,
        links: book.links || [],
        excerpts: book.excerpts || [],
        firstSentence: book.first_sentence,
        authorDetails: authorDetails,
        editionCount: book.edition_count,
        publishDates: editionData?.publish_date,
        physicalFormat: editionData?.physical_format,
        weight: editionData?.weight,
        dimensions: editionData?.dimensions,
        tableOfContents: book.table_of_contents,
        notes: book.notes,
        workId: workKey,
        covers: book.covers || [],
        subjects: book.subjects || [],
        subjectPlaces: book.subject_places || [],
        subjectTimes: book.subject_times || [],
        subjectPeople: book.subject_people || [],
      },
    };

    return normalizeMediaItem(item, "openlibrary");
  } catch (error) {
    if (error instanceof MediaAPIError) {
      throw error;
    }
    console.error("Open Library fetch error:", error);
    throw new MediaAPIError(
      "Failed to fetch book details from Open Library",
      500
    );
  }
}

// Enhanced Jikan detailed fetch functions
async function fetchJikanAnime(id: string): Promise<DetailedMediaItem | null> {
  if (!checkRateLimit("jikan")) {
    throw new MediaAPIError("Rate limit exceeded for Jikan API", 429);
  }

  try {
    // Jikan has strict rate limiting, so we need to be careful
    const [animeResponse, charactersResponse] = await Promise.all([
      fetch(`https://api.jikan.moe/v4/anime/${id}/full`),
      fetch(`https://api.jikan.moe/v4/anime/${id}/characters`).catch(
        () => null
      ),
    ]);

    if (!animeResponse.ok) {
      if (animeResponse.status === 404) {
        throw new MediaAPIError("Anime not found", 404);
      }
      throw new MediaAPIError(
        `Jikan API error: ${animeResponse.status}`,
        animeResponse.status
      );
    }

    const animeData = await animeResponse.json();
    const anime = animeData.data;

    let characters = [];
    if (charactersResponse && charactersResponse.ok) {
      const charactersData = await charactersResponse.json();
      characters =
        charactersData.data?.slice(0, 10).map((char: any) => ({
          name: char.character?.name,
          role: char.role,
          voiceActors: char.voice_actors
            ?.slice(0, 2)
            .map((va: any) => va.person?.name),
        })) || [];
    }

    const item = {
      id: `jikan-anime-${anime.mal_id}`,
      externalId: anime.mal_id.toString(),
      title: anime.title,
      originalTitle:
        anime.title_japanese !== anime.title ? anime.title_japanese : undefined,
      type: "anime" as const,
      year: anime.year || undefined,
      releaseDate: anime.aired?.from || undefined,
      poster:
        anime.images?.jpg?.large_image_url ||
        anime.images?.jpg?.image_url ||
        undefined,
      backdrop: anime.images?.jpg?.large_image_url || undefined,
      description: anime.synopsis || undefined,
      rating: anime.score || undefined,
      voteCount: anime.scored_by || undefined,
      genres: anime.genres?.map((g: any) => g.name) || [],
      episodes: anime.episodes || undefined,
      status: anime.status || undefined,
      studio: anime.studios?.[0]?.name || undefined,
      runtime: anime.duration
        ? parseInt(anime.duration.split(" ")[0])
        : undefined,
      source: "jikan" as const,
      metadata: {
        malId: anime.mal_id,
        type: anime.type,
        source: anime.source,
        duration: anime.duration,
        rating: anime.rating,
        rank: anime.rank,
        popularity: anime.popularity,
        members: anime.members,
        favorites: anime.favorites,
        broadcast: anime.broadcast,
        aired: anime.aired,
        season: anime.season,
        year: anime.year,
        producers: anime.producers?.map((p: any) => p.name) || [],
        licensors: anime.licensors?.map((l: any) => l.name) || [],
        studios: anime.studios?.map((s: any) => s.name) || [],
        themes: anime.themes?.map((t: any) => t.name) || [],
        demographics: anime.demographics?.map((d: any) => d.name) || [],
        explicitGenres: anime.explicit_genres?.map((g: any) => g.name) || [],
        characters: characters,
        trailer: anime.trailer?.youtube_id
          ? {
              youtubeId: anime.trailer.youtube_id,
              url: anime.trailer.url,
              embedUrl: anime.trailer.embed_url,
            }
          : undefined,
        titleSynonyms: anime.title_synonyms || [],
        titleEnglish: anime.title_english,
        approved: anime.approved,
        background: anime.background,
      },
    };

    return normalizeMediaItem(item, "jikan");
  } catch (error) {
    if (error instanceof MediaAPIError) {
      throw error;
    }
    console.error("Jikan anime fetch error:", error);
    throw new MediaAPIError("Failed to fetch anime details from Jikan", 500);
  }
}

async function fetchJikanManga(id: string): Promise<DetailedMediaItem | null> {
  if (!checkRateLimit("jikan")) {
    throw new MediaAPIError("Rate limit exceeded for Jikan API", 429);
  }

  try {
    const [mangaResponse, charactersResponse] = await Promise.all([
      fetch(`https://api.jikan.moe/v4/manga/${id}/full`),
      fetch(`https://api.jikan.moe/v4/manga/${id}/characters`).catch(
        () => null
      ),
    ]);

    if (!mangaResponse.ok) {
      if (mangaResponse.status === 404) {
        throw new MediaAPIError("Manga not found", 404);
      }
      throw new MediaAPIError(
        `Jikan API error: ${mangaResponse.status}`,
        mangaResponse.status
      );
    }

    const mangaData = await mangaResponse.json();
    const manga = mangaData.data;

    let characters = [];
    if (charactersResponse && charactersResponse.ok) {
      const charactersData = await charactersResponse.json();
      characters =
        charactersData.data?.slice(0, 10).map((char: any) => ({
          name: char.character?.name,
          role: char.role,
        })) || [];
    }

    const item = {
      id: `jikan-manga-${manga.mal_id}`,
      externalId: manga.mal_id.toString(),
      title: manga.title,
      originalTitle:
        manga.title_japanese !== manga.title ? manga.title_japanese : undefined,
      type: "manga" as const,
      year: manga.published?.from
        ? new Date(manga.published.from).getFullYear()
        : undefined,
      releaseDate: manga.published?.from || undefined,
      poster:
        manga.images?.jpg?.large_image_url ||
        manga.images?.jpg?.image_url ||
        undefined,
      description: manga.synopsis || undefined,
      rating: manga.score || undefined,
      voteCount: manga.scored_by || undefined,
      genres: manga.genres?.map((g: any) => g.name) || [],
      status: manga.status || undefined,
      author: manga.authors?.map((a: any) => a.name).join(", ") || undefined,
      pages: manga.chapters || undefined,
      source: "jikan" as const,
      metadata: {
        malId: manga.mal_id,
        type: manga.type,
        chapters: manga.chapters,
        volumes: manga.volumes,
        rank: manga.rank,
        popularity: manga.popularity,
        members: manga.members,
        favorites: manga.favorites,
        published: manga.published,
        authors:
          manga.authors?.map((a: any) => ({
            name: a.name,
            role: a.role,
          })) || [],
        serializations: manga.serializations?.map((s: any) => s.name) || [],
        themes: manga.themes?.map((t: any) => t.name) || [],
        demographics: manga.demographics?.map((d: any) => d.name) || [],
        explicitGenres: manga.explicit_genres?.map((g: any) => g.name) || [],
        characters: characters,
        titleSynonyms: manga.title_synonyms || [],
        titleEnglish: manga.title_english,
        approved: manga.approved,
        background: manga.background,
      },
    };

    return normalizeMediaItem(item, "jikan");
  } catch (error) {
    if (error instanceof MediaAPIError) {
      throw error;
    }
    console.error("Jikan manga fetch error:", error);
    throw new MediaAPIError("Failed to fetch manga details from Jikan", 500);
  }
}

export const GET: APIRoute = async ({ params }) => {
  const { type, id } = params;

  if (!type || !id) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "MISSING_PARAMS",
          message: "Missing type or id parameter",
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Validate media type
  const validTypes = ["movie", "tv", "book", "anime", "manga"];
  if (!validTypes.includes(type)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INVALID_TYPE", message: `Invalid media type: ${type}` },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Reject font file requests
  if (id.includes('.woff') || id.includes('.ttf') || id.includes('.eot') || id.includes('.otf')) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INVALID_REQUEST", message: "Font files are not supported media types" },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    let mediaItem: DetailedMediaItem | null = null;

    // Check if this is a database UUID first
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUUID) {
      // This is a database UUID, fetch from database and then get external details
      const { data: dbMedia, error: dbError } = await supabase
        .from('media_items')
        .select('*')
        .eq('id', id)
        .eq('media_type', type)
        .single();

      if (dbError || !dbMedia) {
        throw new MediaAPIError(`Media item not found in database: ${id}`, 404);
      }

      // Try to fetch detailed information from external APIs, but fallback to database data
      const externalId = dbMedia.external_id;
      let externalFetchFailed = false;
      
      try {
        // Parse the external ID to determine source and fetch details
        if (externalId.startsWith("tmdb-")) {
          const tmdbId = externalId.replace("tmdb-", "");
          if (type === "movie") {
            mediaItem = await fetchTMDBMovie(tmdbId);
          } else if (type === "tv") {
            mediaItem = await fetchTMDBTV(tmdbId);
          } else {
            throw new MediaAPIError(
              `TMDB does not support media type: ${type}`,
              400
            );
          }
        } else if (externalId.startsWith("ol-")) {
          if (type === "book") {
            mediaItem = await fetchOpenLibraryBook(externalId);
          } else {
            throw new MediaAPIError(
              `Open Library does not support media type: ${type}`,
              400
            );
          }
        } else if (externalId.startsWith("jikan-anime-")) {
          const jikanId = externalId.replace("jikan-anime-", "");
          if (type === "anime") {
            mediaItem = await fetchJikanAnime(jikanId);
          } else {
            throw new MediaAPIError(
              `Invalid ID format for media type: ${type}`,
              400
            );
          }
        } else if (externalId.startsWith("jikan-manga-")) {
          const jikanId = externalId.replace("jikan-manga-", "");
          if (type === "manga") {
            mediaItem = await fetchJikanManga(jikanId);
          } else {
            throw new MediaAPIError(
              `Invalid ID format for media type: ${type}`,
              400
            );
          }
        } else {
          throw new MediaAPIError(`Unsupported external ID format: ${externalId}`, 400);
        }
      } catch (externalError) {
        console.warn('External API fetch failed, falling back to database data:', externalError);
        externalFetchFailed = true;
      }

      // If external API failed, create a media item from database data
      if (externalFetchFailed || !mediaItem) {
        mediaItem = {
          id: dbMedia.id,
          externalId: dbMedia.external_id,
          title: dbMedia.title,
          type: dbMedia.media_type as "movie" | "tv" | "book" | "anime" | "manga",
          year: dbMedia.release_date ? new Date(dbMedia.release_date).getFullYear() : undefined,
          releaseDate: dbMedia.release_date,
          poster: dbMedia.poster_url,
          description: dbMedia.description,
          genres: dbMedia.genres || [],
          rating: dbMedia.average_rating,
          voteCount: dbMedia.rating_count,
          source: dbMedia.metadata?.source || 'unknown',
          metadata: dbMedia.metadata || {}
        };
      }
    } else {
      // This is an external API ID, parse and fetch directly
      if (id.startsWith("tmdb-")) {
        const externalId = id.replace("tmdb-", "");
        if (type === "movie") {
          mediaItem = await fetchTMDBMovie(externalId);
        } else if (type === "tv") {
          mediaItem = await fetchTMDBTV(externalId);
        } else {
          throw new MediaAPIError(
            `TMDB does not support media type: ${type}`,
            400
          );
        }
      } else if (id.startsWith("ol-")) {
        if (type === "book") {
          mediaItem = await fetchOpenLibraryBook(id);
        } else {
          throw new MediaAPIError(
            `Open Library does not support media type: ${type}`,
            400
          );
        }
      } else if (id.startsWith("jikan-anime-")) {
        const externalId = id.replace("jikan-anime-", "");
        if (type === "anime") {
          mediaItem = await fetchJikanAnime(externalId);
        } else {
          throw new MediaAPIError(
            `Invalid ID format for media type: ${type}`,
            400
          );
        }
      } else if (id.startsWith("jikan-manga-")) {
        const externalId = id.replace("jikan-manga-", "");
        if (type === "manga") {
          mediaItem = await fetchJikanManga(externalId);
        } else {
          throw new MediaAPIError(
            `Invalid ID format for media type: ${type}`,
            400
          );
        }
      } else {
        throw new MediaAPIError(`Unsupported ID format: ${id}`, 400);
      }
    }

    if (!mediaItem) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "NOT_FOUND", message: "Media item not found" },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        media: mediaItem,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      }
    );
  } catch (error) {
    console.error("Media detail API error:", error);

    if (error instanceof MediaAPIError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "API_ERROR", message: error.message },
        }),
        {
          status: error.statusCode,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch media details",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
