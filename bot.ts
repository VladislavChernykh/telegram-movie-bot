import * as fauna_db_pkg from 'faunadb';
import fetch from 'node-fetch';
import TeleBot from "telebot";
import { KpInfo, KpResponse, MovieData } from './utils/models';
import { getKpLink, random_item } from './utils/utils';

const {
    Client,
    Collection,
    Index,
    Match,
    Paginate,
    Create,
    Delete,
    Map,
    Lambda,
    Var,
    Function: Fn,
    Call,
    Update,
} = fauna_db_pkg;

const bot = new TeleBot(process.env.TELEGRAM_BOT_TOKEN)
const faunadbClient = new Client({ secret: process.env.FAUNA_SERVER_TOKEN })

async function getMoviesFromKp(movieName: string, field: string = "name"): Promise<MovieData[]> {
    const url = `https://api.kinopoisk.dev/movie?token=${process.env.KP_API_TOKEN}&search=${movieName}&field=${field}&isStrict=false&sortField=votes.imdb&sortType=-1`
    try {
        const response = await fetch(url);
        if (response.status != 200) {
            console.log(`Unseccessful request with code ${response.status}`)
        }

        const data = await response.json() as KpResponse;
        console.log(JSON.stringify(data))

        if (!data.docs.length) {
            console.log("No movie was found")
            return
        }

        return data.docs
            .filter(m => m.year)
            .map(movie => ({
                "name": movie.name,
                "year": movie.year,
                "length": movie.movieLength || 0,
                "eng_name": movie.alternativeName || "",
                "kp_rating": movie.rating.kp || 0,
                "imdb_rating": movie.rating.imdb || 0,
                "description": movie.description || "",
                "movie_kp_url": getKpLink(movie.type, movie.id)
            }))

    } catch (error) {
        console.log(error)
    }
}

function generateMessage(movieData: MovieData[]): string[] {
    let messageReply = ""
    let movieIndex = 1
    let elementIndex = 1
    let messages: string[] = []

    if (!movieData) {
        return []
    }

    for (let m of movieData) {
        messageReply += `
*${movieIndex}*: ${m.name} / ${m.eng_name}
*Длительность*: ${m.length} мин.
*Год*: ${m.year}
*Рейтинг*: IMDB ${m.imdb_rating}, Кинопоиск ${m.kp_rating}
*Описание*: ${m.description}
*Ссылка на Кинопоиск*: ${m.movie_kp_url}

        `
        movieIndex++
        elementIndex++
        if (elementIndex > 4) {
            messages.push(messageReply)
            messageReply = ""
            elementIndex = 0
        }
    }
    messages.push(messageReply)

    return messages
}

async function getAllUserMovies(msg: any): Promise<string[]> {
    const userId = msg.from.id
    const resp = await faunadbClient.query(
        Call(Fn("getAllUserMovies"), userId)
    )
    return resp["data"]
}

bot.on('/start', msg => {
    let bot_action_description = `
/start - начать работу бота
/random - выбрать случайный фильм из моего списка
/all_my_movies - все мои фильмы
/add *название фильма* - добавить фильм в мой список
/rm *название фильма* - удалить фильм из моего списка
    `

    let replyMarkup = bot.keyboard([
        ['/start', '/random', "/all_my_movies"],
    ], { resize: true });

    return bot.sendMessage(msg.from.id, bot_action_description, { replyMarkup });
});

bot.on(/^\/add (.+)$/, async (msg, props) => {
    let movie_name = props.match[1];
    const userId = msg.from.id
    if (!movie_name) {
        console.log("empty movie name")
        return
    }

    movie_name = movie_name.trim()
    const allUserMovies = await getAllUserMovies(msg)

    if (allUserMovies.includes(movie_name)) {
        return bot.sendMessage(msg.from.id, `Фильм '${movie_name}' уже есть в вашем списке`);
    }

    const resp = await faunadbClient.query(
        Create(
            Collection("movies"),
            {
                data: { name: movie_name, userId: userId }
            }
        )
    )

    return bot.sendMessage(msg.from.id, `Фильм '${movie_name}' был добавлен в список`);
});

bot.on(/^\/rm (.+)$/, async (msg, props) => {
    let movie_name = props.match[1];
    const userId = msg.from.id
    if (!movie_name) {
        console.log("empty movie name")
        return
    }

    movie_name = movie_name.trim()

    const resp = await faunadbClient.query(
        Map(
            Paginate(
                Match(Index("movies_by_userId_and_name"),
                    [movie_name, userId]
                )
            ),
            Lambda("X", Delete(Var("X")))
        )
    )

    if (!resp["data"].length) {
        return bot.sendMessage(msg.from.id, `Фильма '${movie_name}' нет в списке для удаления`);
    }

    return bot.sendMessage(msg.from.id, `Фильм '${movie_name}' был удалён из списка`);
});

bot.on('/env', (msg) => msg.reply.text(process.env.VERCEL_ENV));

bot.on("/all_my_movies", async (msg) => {
    const allUserMovies = await getAllUserMovies(msg)
    let movieCounter = 1
    let allMoviesList = ""
    for (let m of allUserMovies) {
        allMoviesList += `${movieCounter}. ${m}\n`
        movieCounter++
    }

    return bot.sendMessage(msg.from.id, allMoviesList);
})

async function getMovieData(randomMovie: string): Promise<[MovieData[], number]> {
    /**
     * Get movie data from cache or from the KP API. 
     * Send the document reference only if movie has been found and no data already stored.
     */
    let movieData: MovieData[];
    let movieRef: number
    try {
        console.log(`Random movie: ${randomMovie}`)
        let kp_response: KpInfo = await faunadbClient.query(
            Call(Fn("getMovieKp"), randomMovie)
        )
        console.log("KP response")
        console.log(JSON.stringify(kp_response))
        if (kp_response.kp) {
            movieData = kp_response.kp
        } else {
            movieRef = kp_response.ref
        }
    } catch (e) {
        console.log(`WARN: Maybe no KP data. Error occured: ${e}`)
    }

    if (!movieData) {
        console.log("Fetch data from KP")
        movieData = await getMoviesFromKp(randomMovie)
    }

    console.log("Movie data")
    console.log(movieData)

    if (movieData && movieData.length > 16) {
        movieData = movieData.slice(16)
        console.log(`The results were trancated. Actual number of results: ${movieData.length}`)
    }

    return [movieData, movieRef]
}


bot.on('/random', async msg => {
    const allUserMovies = await getAllUserMovies(msg)
    if (!allUserMovies.length) {
        return bot.sendMessage(msg.from.id, "Ваш список фильмов пустой. Пополните его перед тем, как выбирать случайный");
    }

    const randomMovie = random_item(allUserMovies)
    const [movieData, movieRef] = await getMovieData(randomMovie)

    // Send the movie name
    await bot.sendMessage(msg.from.id, randomMovie);

    // Prepare the movie info
    const messageReplies = generateMessage(movieData)

    for (let reply of messageReplies) {
        await bot.sendMessage(msg.from.id, reply, { parseMode: "Markdown" });
    }

    // Update the info
    if (movieRef && movieData) {
        console.log(`movie ref ${movieRef}`)
        await faunadbClient.query(
            Update(
                movieRef,
                { data: { kp: movieData } }
            )
        )
    }
});

export default bot
