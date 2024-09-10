import {z, defineCollection } from 'astro:content'

const bookCollection = defineCollection({
    type:"data",
    schema: z.object({
        author: z.string(),
        awards: z.array(z.string()),
        bookId: z.string(),
        characters: z.string(),
        description: z.string().max(40),
        firstPublishDate: z.date(),
        genres: z.array(z.string()),
        isbn: z.string(),
        language: z.string(),
        pages: z.string(),
        publishDate: z.date(),
        publisher: z.string(),
        series: z.string(),
        title: z.string()
      
    })
});


const animeCollection = defineCollection({
    type:"data",
    schema: z.object({
        
        aired: z.string(),
        aired_string: z.string(),
        airing: z.boolean(),
        anime_id: z.number(),
        duration: z.string(),
        episodes: z.string(),
        genre: z.array(z.string()),
        licensor: z.string(),
        producer: z.string(),
        rating: z.string(),
        related: z.string(),
        source: z.string(),
        status: z.string(),
        studio: z.string(),
        title: z.string(),
        type: z.string(),
    })
});

export const collection = {
    'books' : bookCollection,
}

export const collection2 = {
    'anime' : animeCollection,
}