import fauna_db_pkg from 'faunadb';
const { Client, Collection, Get, Ref, Index, Match, Paginate } = fauna_db_pkg;
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

bot.on('/start', msg => {

    let bot_action_description = `
/start - начать работу бота
/random - выбрать случайный фильм из моего списка
/random_all - выбрать случайный фильм из всех фильмов в сервисе
/add *название фильма* - добавить фильм в мой список
/remove *название фильма* - удалить фильм из моего списка
    `

    let replyMarkup = bot.keyboard([
        ['/random', '/random_all'],
    ], { resize: true });

    return bot.sendMessage(msg.from.id, bot_action_description, { replyMarkup });
});

bot.on(/^\/add (.+)$/, (msg, props) => {
    console.log(msg)
    console.log(props)
    const movie_name = props.match[1];
    return bot.sendMessage(msg.from.id, `Фильм '${movie_name}' был добвален в список`);
});

bot.on(/^\/remove (.+)$/, (msg, props) => {
    console.log(msg)
    console.log(props)
    const movie_name = props.match[1];
    return bot.sendMessage(msg.from.id, `Фильм '${movie_name}' был удалён из списка`);
});

bot.on('/random', msg => {

    return bot.sendMessage(msg.from.id, 'Случайный фильм');
});

bot.on('/random_all', msg => {

    return bot.sendMessage(msg.from.id, 'Случайный фильм из всей коллекции.');
});


bot.on('text', msg => msg.text.startsWith("/") ? null : msg.reply.text(msg.text))

bot.on('/start1', (msg) => msg.reply.photo("https://picsum.photos/1000"));

bot.on('/env', (msg) => msg.reply.text(process.env.VERCEL_ENV));

bot.on('/ttt', (msg) => bot.sendMessage(msg.from.id, "Hi!",
    {
        replyMarkup: {
            inline_keyboard: [
                [{ "text": "Click me", callback_data: "one" }]
            ]
        }
    }));

bot.on(/^\/say (.+)$/, (msg, props) => {
    console.log(msg)
    console.log(props)
    const text = props.match[1];
    return bot.sendMessage(msg.from.id, text, { replyToMessage: msg.message_id });
});

bot.on(/^\/all_movies_by_id (.+)$/, async (msg) => {
    console.log(msg)
    const userId = msg.message.from.id
    console.log(userId)
    const resp = await faunadbClient.query(
        // Get(
        //     Ref(
        //         Collection("movies"),
        //         "342767518987846219"
        //     )
        // )
        Paginate(
            Match(
                Index("movies_by_userId"), userId)
        )
    )
    const all_movies = resp["data"]
    console.log(JSON.stringify(all_movies))

    return bot.sendMessage(msg.from.id, JSON.stringify(all_movies));
})


export default bot
