const superagent = require('superagent')
const cheerio = require('cheerio')
const convertPlayerJSPlaylist = require('./convertPlayerJSPlaylist')
const stripPlayerJSConfig = require('./stripPlayerJSConfig')

module.exports = async (url) => {
    const res = await superagent.get(url.startsWith('//') ? 'https:' + url : url)
    const $ = cheerio.load(res.text)

    const script = $('script:not([src])').nextAll('')

    const config = stripPlayerJSConfig(script)

    if (config) {
        const { file } = config
        return convertPlayerJSPlaylist(file)
    }
}