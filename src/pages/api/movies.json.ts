import type { APIRoute } from "astro"
const url = "https://www.omdbapi.com/?i=tt3896198&apikey=a18aad21&t=deadpool+and+wolverine&y=2024" 


export const GET: APIRoute = async  ( context ) => {

    console.log(context);
    const response = await fetch(url);
    const data = await response.json();
    return new Response(JSON.stringify(data));

  }