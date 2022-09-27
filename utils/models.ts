export interface MovieData {
    "name": string,
    "year": number | string,
    "length": number | string,
    "eng_name": string | null,
    "kp_rating": number,
    "imdb_rating": number,
    "description": string,
    "movie_kp_url": string
}

export interface KpInfo {
    kp: MovieData[],
    ref: number
}

export interface KpResponse {
    docs: Doc[],
    total: number
}

export enum MovieType {
    SERIES = "tv-series",
    MOVIE = "movie"
}

export interface Doc {
    "poster": {
        "url": string,
        "previewUrl": string
    },
    "rating": {
        "kp": number,
        "imdb": number,
    },
    "movieLength": number,
    "id": number,
    "type": "movie",
    "name": string,
    "description": string,
    "year": number,
    "alternativeName": string,
    "enName": null,
    "names": {
        "name": string
    }[]
    "shortDescription": string
}

export interface DbMovie {
    name: string
    userId: number
    kp?: MovieData[]
}