const en = require('./en.json')
const vi = require('./vi.json')
module.exports = (language) => {
  const languageConfig = {
    en,
    vi
  }
  return languageConfig[language] || languageConfig['vi']
}
