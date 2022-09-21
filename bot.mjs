import fauna_db_pkg from 'faunadb';
const {
    Client,
    Collection,
    Collections,
    Get,
    Ref,
    Index,
    Match,
    Paginate,
    Create,
    Delete,
    Map,
    Lambda,
    Var,
    Function: Fn,
    Call
} = fauna_db_pkg;
import TeleBot from "telebot"

const bot = new TeleBot(process.env.TELEGRAM_BOT_TOKEN)
const faunadbClient = new Client({ secret: process.env.FAUNA_SERVER_TOKEN })

async function getMovieFromKp(movieName) {
    let url = `https://api.kinopoisk.dev/movie?
    token=${process.env.KP_API_TOKEN}&search=${movieName}&field=name&isStrict=false`
    try {
        let response = await fetch(url);
        if (response.status != 200) {
            console.log(`Unseccessful request with code ${response.status}`)
        }

        let data = await response.json();
        console.log(data)

        let movie = data.doc
        if (!movie) {
            console.log("No movie was found")
            return
        }

        return {
            "year": movie.year,
            "length": movie.movieLength,
            "eng_name": movie.alternativeName,
            "pic_url": movie.poster.url,
            "kp_rating": movie.rating.kp,
            "imdb_rating": movie.rating.imdb_rating,
            "description": movie.description
        }


    } catch (error) {
        console.log(error)
    }
}

function random_item(items) {
    return items[Math.floor(Math.random() * items.length)];
}

bot.on('/start', msg => {
    let bot_action_description = `
/start - начать работу бота
/random - выбрать случайный фильм из моего списка
/all_my_movies - все мои фильмы
/add *название фильма* - добавить фильм в мой список
/remove *название фильма* - удалить фильм из моего списка
    `

    let replyMarkup = bot.keyboard([
        ['/random', "/all_my_movies"],
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
    const resp = await faunadbClient.query(
        Create(
            Collection("movies"),
            {
                data: { name: movie_name, userId: userId }
            }
        )
    )
    console.log(JSON.stringify(resp))

    return bot.sendMessage(msg.from.id, `Фильм '${movie_name}' был добавлен в список`);
});

bot.on(/^\/remove (.+)$/, async (msg, props) => {
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
    console.log(JSON.stringify(resp))

    if (!resp["data"].length) {
        return bot.sendMessage(msg.from.id, `Фильма '${movie_name}' нет в списке для удаления`);
    }

    return bot.sendMessage(msg.from.id, `Фильм '${movie_name}' был удалён из списка`);
});

bot.on('/random', async msg => {
    const userId = msg.from.id
    const resp = await faunadbClient.query(
        Call(Fn("getAllUserMovies"), userId)
    )
    const allUserMovies = resp["data"]
    if (!allUserMovies.length) {
        return bot.sendMessage(msg.from.id, "Ваш список фильмов пустой. Пополните его перед тем как выбирать случайный");
    }

    return bot.sendMessage(msg.from.id, random_item(allUserMovies));
});

bot.on('/env', (msg) => msg.reply.text(process.env.VERCEL_ENV));

bot.on("/all_my_movies", async (msg) => {
    const userId = msg.from.id
    const resp = await faunadbClient.query(
        Call(Fn("getAllUserMovies"), userId)
    )
    const allUserMovies = resp["data"]
    console.log(JSON.stringify(allUserMovies))

    return bot.sendMessage(msg.from.id, JSON.stringify(allUserMovies));
})


export default bot
