import { MovieType } from "./models";

export function getKpLink(movieType: string, kpId: number): string {
    let movieTypeUrl: string;
    if (movieType == MovieType.MOVIE) {
        movieTypeUrl = "film"
    } else {
        movieTypeUrl = "series"
    }

    return `https://www.kinopoisk.ru/${movieTypeUrl}/${kpId}/`
}

export function random_item(items: string[]): string {
    return items[Math.floor(Math.random() * items.length)];
}