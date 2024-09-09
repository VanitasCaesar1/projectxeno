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
export const collection = {
    'books' : bookCollection,
}