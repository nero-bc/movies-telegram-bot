const providers = require('./providers')

providers.getInfo('kinogo', 'https%3A%2F%2Fkinogo.by%2F14991-penguin-highway_2018.html')
    .then(console.dir) // eslint-disable-line