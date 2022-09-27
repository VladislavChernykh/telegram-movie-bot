import bot from "../bot"

const isDev = process.env.VERCEL_ENV === 'development',
    webHookURL = host => `https://${host}/api/telegram.ts`

export default async ({ body: { url }, headers }, { json }) =>
    json(await bot.setWebhook(isDev && url ? url : webHookURL(headers['x-forwarded-host'])).catch(e => e))
